import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { error: "GEMINI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const interactionId = new URL(request.url).searchParams.get("id");

    if (!interactionId) {
      return Response.json({ error: "Missing interaction id." }, { status: 400 });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1" }
    });

    const interaction = await ai.interactions.get(interactionId);

    if (interaction.status === "completed") {
      const raw = interaction.output_text?.trim();

      if (!raw) {
        return Response.json({ error: "Gemini returned an empty response." }, { status: 500 });
      }

      return Response.json({
        status: "completed",
        result: JSON.parse(raw)
      });
    }

    if (interaction.status === "failed") {
      return Response.json(
        { status: "failed", error: interaction.error || "Gemini analysis failed." },
        { status: 500 }
      );
    }

    return Response.json({ status: interaction.status || "in_progress" });
  } catch (error) {
    console.error("Syllabus analysis status error:", error);

    return Response.json(
      { error: error.message || "Could not check analysis status." },
      { status: 500 }
    );
  }
}
