import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const schema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" }
          },
          correctAnswer: { type: "integer" },
          explanation: { type: "string" },
          topic: { type: "string" }
        },
        required: ["question", "options", "correctAnswer", "explanation", "topic"]
      }
    }
  },
  required: ["questions"]
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
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const unit = typeof body.unit === "string" ? body.unit.trim() : "";
    const topics = Array.isArray(body.topics)
      ? body.topics.filter((topic) => typeof topic === "string" && topic.trim())
      : [];
    const requestedCount = Number(body.numberOfQuestions);
    const numberOfQuestions = [5, 10].includes(requestedCount) ? requestedCount : 5;

    if (!subject || !unit || topics.length === 0) {
      return Response.json(
        { error: "Subject, unit, and at least one topic are required." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1beta" }
    });

    const prompt = `Create a university-level multiple-choice quiz from the syllabus topics below.

Subject: ${subject}
Unit: ${unit}
Topics:
${topics.map((topic) => `- ${topic}`).join("\n")}

Requirements:
- Create exactly ${numberOfQuestions} questions.
- Use only the supplied topics. Do not invent unrelated material.
- Each question must have exactly 4 options.
- correctAnswer must be the zero-based index of the correct option (0, 1, 2, or 3).
- Include a short explanation for the correct answer.
- For every question, include "topic" containing exactly one of the supplied topic names.
- Mix conceptual and practical/application questions where the topics allow.
- Avoid duplicate questions.
- Return only the requested JSON structure.`;

    const interaction = await ai.interactions.create({
      model: "gemini-3.5-flash-lite",
      input: prompt,
      generation_config: {
        thinking_level: "low",
        max_output_tokens: 5000
      },
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema
      }
    });

    const raw = interaction.output_text?.trim();

    if (!raw) {
      throw new Error("Gemini returned an empty quiz response.");
    }

    const result = JSON.parse(raw);

    if (!Array.isArray(result.questions) || result.questions.length !== numberOfQuestions) {
      throw new Error("Gemini returned an unexpected number of quiz questions.");
    }

    for (const question of result.questions) {
      if (
        typeof question.question !== "string" ||
        typeof question.topic !== "string" ||
        !topics.includes(question.topic) ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        !Number.isInteger(question.correctAnswer) ||
        question.correctAnswer < 0 ||
        question.correctAnswer > 3
      ) {
        throw new Error("Gemini returned an invalid quiz question.");
      }
    }

    return Response.json({
      subject,
      unit,
      questions: result.questions
    });
  } catch (error) {
    console.error("Quiz generation error:", error);

    return Response.json(
      { error: error.message || "Could not generate the quiz." },
      { status: 500 }
    );
  }
}
