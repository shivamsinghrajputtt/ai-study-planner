import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 100000;

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

    const prompt = `Analyze this university syllabus and extract its academic structure.

Return only information that is explicitly supported by the syllabus. Do not invent subjects, units, or topics.

Rules:
- Identify each subject/course.
- Preserve subject names and course codes when present.
- Group topics under the correct unit/module.
- Keep topic names concise but complete.
- Ignore page numbers, exam instructions, textbook/reference lists, and administrative text.
- If a subject has no clear units, create one unit named "Topics" and place its syllabus topics there.
- Return an empty string for a missing course code.

SYLLABUS:
${text}`;

    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash-lite",
      input: prompt,
      generation_config: {
        thinking_level: "low",
        max_output_tokens: 1800
      },
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema
      }
    });

    const raw = interaction.output_text?.trim();

    if (!raw) {
      throw new Error("Gemini returned an empty response.");
    }

    let result;

    try {
      result = JSON.parse(raw);
    } catch (parseError) {
      console.warn("Gemini returned malformed JSON; retrying once.", parseError);

      const retry = await ai.interactions.create({
        model: "gemini-3.5-flash-lite",
        input: `${prompt}

IMPORTANT: Your previous response was not valid JSON. Retry once.
Return ONLY one valid JSON object matching the provided schema.
Do not use markdown fences.
Do not put literal line breaks inside string values.
Keep every topic as a short single-line string.`,
        generation_config: {
          thinking_level: "low",
          max_output_tokens: 1800
        },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema
        }
      });

      const retryRaw = retry.output_text?.trim();

      if (!retryRaw) {
        throw new Error("Gemini returned an empty response on retry.");
      }

      result = JSON.parse(retryRaw);
    }

    if (!Array.isArray(result.subjects)) {
      throw new Error("Gemini returned an invalid syllabus structure.");
    }

    return Response.json(result);
  } catch (error) {
    console.error("Syllabus analysis error:", error);

    return Response.json(
      { error: error.message || "Could not analyze the syllabus." },
      { status: 500 }
    );
  }
}
