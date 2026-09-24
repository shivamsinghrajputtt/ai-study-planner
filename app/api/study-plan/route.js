import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "integer" },
          date: { type: "string" },
          focus: { type: "string" },
          topics: {
            type: "array",
            items: { type: "string" }
          },
          tasks: {
            type: "array",
            items: { type: "string" }
          },
          durationMinutes: { type: "integer" }
        },
        required: ["day", "date", "focus", "topics", "tasks", "durationMinutes"]
      }
    }
  },
  required: ["summary", "days"]
};

function buildFallbackPlan({ subject, unit, topics, weakTopics, examDate, dailyHours, daysAvailable }) {
  const weak = weakTopics
    .slice()
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .map((item) => item.topic)
    .filter(Boolean);

  const orderedTopics = [...new Set([...weak, ...topics])];
  const maxMinutes = Math.round(dailyHours * 60);
  const safeMinutes = Math.max(30, maxMinutes);
  const planDays = [];

  for (let index = 0; index < daysAvailable; index += 1) {
    const date = new Date(examDate + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - (daysAvailable - 1 - index));
    const dateString = date.toISOString().slice(0, 10);

    const topic = orderedTopics[index % orderedTopics.length];
    const isFinalDay = index === daysAvailable - 1;
    const focus = isFinalDay
      ? "Final revision and weak-topic review"
      : weak.includes(topic)
        ? "Weak-topic focused revision"
        : "Concept learning and active recall";

    const dayTopics = isFinalDay
      ? [...new Set([...weak, ...topics])].slice(0, Math.max(1, Math.min(4, topics.length)))
      : [topic];

    const tasks = isFinalDay
      ? [
          "Review the key concepts from the selected unit.",
          "Revisit weak topics and test yourself without notes.",
          "Do a final active-recall revision of the unit."
        ]
      : [
          `Study and understand: ${topic}`,
          "Write short notes or key points from memory.",
          "Finish with 10–15 minutes of active recall."
        ];

    planDays.push({
      day: index + 1,
      date: dateString,
      focus,
      topics: dayTopics,
      tasks,
      durationMinutes: safeMinutes
    });
  }

  return {
    summary: `A ${daysAvailable}-day study plan for ${subject} · ${unit}, prioritizing quiz weak topics and covering the supplied syllabus topics within ${dailyHours} hours per day.`,
    days: planDays
  };
}

function daysBetweenTodayAnd(examDate) {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const exam = new Date(examDate + "T00:00:00Z").getTime();

  if (!Number.isFinite(exam) || exam < today) {
    return null;
  }

  return Math.floor((exam - today) / 86400000) + 1;
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
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const unit = typeof body.unit === "string" ? body.unit.trim() : "";
    const examDate = typeof body.examDate === "string" ? body.examDate.trim() : "";
    const dailyHours = Number(body.dailyHours);
    const topics = Array.isArray(body.topics)
      ? body.topics.filter((topic) => typeof topic === "string" && topic.trim())
      : [];
    const weakTopics = Array.isArray(body.weakTopics)
      ? body.weakTopics
          .filter((item) => item && typeof item.topic === "string")
          .map((item) => ({
            topic: item.topic.trim(),
            wrongCount: Number(item.wrongCount) || 0
          }))
      : [];

    const daysAvailable = daysBetweenTodayAnd(examDate);

    if (!subject || !unit || !examDate || topics.length === 0) {
      return Response.json(
        { error: "Subject, unit, exam date, and topics are required." },
        { status: 400 }
      );
    }

    if (!daysAvailable) {
      return Response.json(
        { error: "Exam date must be today or a future date." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(dailyHours) || dailyHours < 0.5 || dailyHours > 12) {
      return Response.json(
        { error: "Daily study time must be between 0.5 and 12 hours." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1beta" }
    });

    const weakTopicText = weakTopics.length
      ? weakTopics.map((item) => `- ${item.topic} (${item.wrongCount} wrong answer(s))`).join("\n")
      : "- No weak topics detected yet. Give balanced coverage to all supplied topics.";

    const prompt = `Create a practical, personalized study plan for a university student.

Subject: ${subject}
Unit: ${unit}
Exam date: ${examDate}
Days available: ${daysAvailable}
Daily study time: ${dailyHours} hours

All syllabus topics:
${topics.map((topic) => `- ${topic}`).join("\n")}

Weak topics from the student's quiz:
${weakTopicText}

Rules:
- Use only the supplied syllabus topics.
- Prioritize weak topics, especially those with more wrong answers.
- Spread the workload realistically across the available days.
- Every day must fit within the student's daily study time.
- Include learning, active recall/practice, and revision where appropriate.
- The final day should focus on revision and weak-topic review rather than introducing large amounts of new material.
- Keep tasks concrete and student-friendly.
- durationMinutes must not exceed ${Math.round(dailyHours * 60)}.
- Return exactly ${daysAvailable} day entries.
- Use YYYY-MM-DD for every date.
- Do not invent topics or resources.
- Return only the requested JSON structure.`;

    let result;
    let aiGenerated = true;

    try {
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
        throw new Error("Gemini returned an empty study plan response.");
      }

      result = JSON.parse(raw);

      if (!Array.isArray(result.days) || result.days.length !== daysAvailable) {
        throw new Error("Gemini returned an unexpected number of study-plan days.");
      }
    } catch (aiError) {
      console.error("AI study plan generation failed; using deterministic fallback:", aiError);
      aiGenerated = false;
      result = buildFallbackPlan({
        subject,
        unit,
        topics,
        weakTopics,
        examDate,
        dailyHours,
        daysAvailable
      });
    }

    return Response.json({
      subject,
      unit,
      examDate,
      dailyHours,
      daysAvailable,
      aiGenerated,
      ...result
    });
  } catch (error) {
    console.error("Study plan generation error:", error);

    return Response.json(
      { error: error.message || "Could not generate the study plan." },
      { status: 500 }
    );
  }
}
