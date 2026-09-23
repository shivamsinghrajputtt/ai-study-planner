import pdf from "pdf-parse";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

    return Response.json({
      fileName: file.name || "syllabus.pdf",
      pages: data.numpages || 0,
      characters: data.text?.length || 0,
      text: data.text?.trim() || "",
    });
  } catch (error) {
    console.error("PDF extraction error:", error);

    return Response.json(
      {
        error:
          "Could not read this PDF. Try a text-based PDF rather than a scanned image PDF.",
      },
      { status: 500 }
    );
  }
}
