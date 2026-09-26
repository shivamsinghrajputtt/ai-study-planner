import { GoogleGenAI } from "@google/genai";
import pdf from "pdf-parse";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const OCR_MIN_CHARACTERS = 100;

async function extractScannedPdfWithGemini(buffer) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { apiVersion: "v1beta" },
  });

  const interaction = await ai.interactions.create({
    model: "gemini-3.5-flash-lite",
    input: [
      {
        type: "document",
        data: buffer.toString("base64"),
        mime_type: "application/pdf",
      },
      {
        type: "text",
        text: "Transcribe the visible text from this PDF accurately.\n\nRules:\n- Return the document text only.\n- Preserve the reading order of the pages.\n- Preserve headings, course codes, unit numbers, bullet points, and table content as plain text.\n- Do not summarize, explain, or invent anything.\n- Do not add markdown fences.\n- If a page contains a table, transcribe its text in a readable line-by-line format.\n- Include all meaningful syllabus content from every page.",
      },
    ],
    generation_config: {
      thinking_level: "low",
      max_output_tokens: 8000,
    },
  });

  const text = interaction.output_text?.trim();

  if (!text) {
    throw new Error("Gemini could not read the scanned PDF.");
  }

  return text;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json({ error: "Please upload a PDF file." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name?.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "PDF is too large. Please upload a file smaller than 10 MB." },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdf(buffer);

    let text = data.text?.trim() || "";
    let extractionMethod = "pdf-text";

    if (text.length < OCR_MIN_CHARACTERS) {
      text = await extractScannedPdfWithGemini(buffer);
      extractionMethod = "gemini-ocr";
    }

    return Response.json({
      fileName: file.name || "syllabus.pdf",
      pages: data.numpages || 0,
      characters: text.length,
      text,
      extractionMethod,
    });
  } catch (error) {
    console.error("PDF extraction error:", error);

    return Response.json(
      {
        error:
          error.message ||
          "Could not read this PDF. Try a clear text-based or scanned PDF.",
      },
      { status: 500 }
    );
  }
}
