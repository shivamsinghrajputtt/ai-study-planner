import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 100000;
const CHUNK_SIZE = 7500;
const CHUNK_OVERLAP = 700;

const schema = {
  type: "object",
  properties: {
    subjects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          code: { type: "string" },
          units: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                topics: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["name", "topics"]
            }
          }
        },
        required: ["name", "code", "units"]
      }
    }
  },
  required: ["subjects"]
};

function splitIntoChunks(text) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const hardEnd = Math.min(start + CHUNK_SIZE, text.length);

    if (hardEnd === text.length) {
      chunks.push(text.slice(start));
      break;
    }

    const searchStart = Math.max(start, hardEnd - 1200);
    const breakAt = text.lastIndexOf("\n", hardEnd);
    const safeBreak = breakAt >= searchStart ? breakAt : hardEnd;

    chunks.push(text.slice(start, safeBreak).trim());

    const nextStart = Math.max(safeBreak - CHUNK_OVERLAP, start + 1);
    start = nextStart;
  }

  return chunks.filter(Boolean);
}

function mergeAnalyses(results) {
  const subjectMap = new Map();

  for (const result of results) {
    for (const subject of result?.subjects || []) {
      const name = typeof subject.name === "string" ? subject.name.trim() : "";
      if (!name) continue;

      const key = name.toLowerCase();
      let merged = subjectMap.get(key);

      if (!merged) {
        merged = {
          name,
          code: typeof subject.code === "string" ? subject.code.trim() : "",
          units: []
        };
        subjectMap.set(key, merged);
      } else if (!merged.code && typeof subject.code === "string") {
        merged.code = subject.code.trim();
      }

      for (const unit of subject.units || []) {
        const unitName = typeof unit.name === "string" ? unit.name.trim() : "";
        if (!unitName) continue;

        const unitKey = unitName.toLowerCase();
        let mergedUnit = merged.units.find(
          (item) => item.name.trim().toLowerCase() === unitKey
        );

        if (!mergedUnit) {
          mergedUnit = { name: unitName, topics: [] };
          merged.units.push(mergedUnit);
        }

        for (const topic of unit.topics || []) {
          if (typeof topic !== "string") continue;
          const cleanTopic = topic.trim();
          if (!cleanTopic) continue;

          const exists = mergedUnit.topics.some(
            (item) => item.toLowerCase() === cleanTopic.toLowerCase()
          );

          if (!exists) {
            mergedUnit.topics.push(cleanTopic);
          }
        }
      }
    }
  }

  return {
    subjects: [...subjectMap.values()].filter(
      (subject) => subject.units.some((unit) => unit.topics.length > 0)
    )
  };
}

async function analyzeChunk(ai, chunk, index, total) {
  const prompt = `Analyze this PART of a university syllabus.

This is chunk ${index + 1} of ${total}. The chunk may start or end in the middle of a subject or unit.

Return only information explicitly supported by this chunk. Do not invent missing subjects, units, topics, codes, or details.

Rules:
- Identify course/subject names and codes when they appear.
- Group topics under the correct unit/module when the unit heading is present.
- If a topic clearly belongs to a unit whose heading appeared just before this chunk, keep it under that unit.
- Ignore page numbers, exam instructions, references, textbooks, administrative text, and repeated university headers.
- Keep topic strings concise but complete.
- It is valid to return only the subjects/units/topics visible in this chunk.
- Return an empty string for a missing course code.

SYLLABUS CHUNK:
${chunk}`;

  const request = {
    model: "gemini-3.5-flash-lite",
    input: prompt,
    generation_config: {
      thinking_level: "minimal",
      max_output_tokens: 3000
    },
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema
    }
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const interaction = await ai.interactions.create(request);

    if (interaction.status === "incomplete") {
      if (attempt === 1) {
        throw new Error(`Gemini truncated syllabus chunk ${index + 1}.`);
      }
      continue;
    }

    const raw = interaction.output_text?.trim();

    if (!raw) {
      if (attempt === 1) {
        throw new Error(`Gemini returned an empty response for syllabus chunk ${index + 1}.`);
      }
      continue;
    }

    try {
      const result = JSON.parse(raw);

      if (!Array.isArray(result.subjects)) {
        throw new Error("Invalid subjects array.");
      }

      return result;
    } catch (error) {
      if (attempt === 1) {
        throw new Error(
          `Gemini returned invalid JSON for syllabus chunk ${index + 1}: ${error.message}`
        );
      }
    }
  }

  throw new Error(`Could not analyze syllabus chunk ${index + 1}.`);
}

export async function POST(request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { error: "GEMINI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return Response.json({ error: "No syllabus text was provided." }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return Response.json(
        { error: "Syllabus text is too large. Please use a smaller PDF." },
        { status: 413 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1beta" }
    });

    const chunks = splitIntoChunks(text);

    if (!chunks.length) {
      return Response.json({ error: "Could not split syllabus text for analysis." }, { status: 400 });
    }

    const results = await Promise.all(
      chunks.map((chunk, index) => analyzeChunk(ai, chunk, index, chunks.length))
    );

    const merged = mergeAnalyses(results);

    if (!merged.subjects.length) {
      throw new Error("Gemini could not identify any syllabus subjects or topics.");
    }

    return Response.json(merged);
  } catch (error) {
    console.error("Syllabus analysis error:", error);

    return Response.json(
      { error: error.message || "Could not analyze the syllabus." },
      { status: 500 }
    );
  }
}
