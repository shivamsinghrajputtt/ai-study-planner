"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setError("Please select a PDF first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not extract the PDF.");
      }

      setResult(data);
      setAnalysis(null);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function analyzeSyllabus() {
    if (!result?.text) return;

    setAnalyzing(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await fetch("/api/analyze-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result.text }),
      });

      const data = await response.json();

      if (!response.ok && response.status !== 202) {
        throw new Error(data.error || "Could not start syllabus analysis.");
      }

      if (!data.interactionId) {
        setAnalysis(data);
        return;
      }

      let completed = false;

      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusResponse = await fetch(
          `/api/analyze-syllabus/status?id=${encodeURIComponent(data.interactionId)}`
        );
        const statusData = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(statusData.error || "Could not check analysis status.");
        }

        if (statusData.status === "completed") {
          setAnalysis(statusData.result);
          completed = true;
          break;
        }

        if (statusData.status === "failed") {
          throw new Error(statusData.error || "Gemini analysis failed.");
        }
      }

      if (!completed) {
        throw new Error("Analysis is taking longer than expected. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-400">
          AI Study Planner · V0.1
        </p>

        <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
          Turn your syllabus into a personalized study plan.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Start by uploading a syllabus PDF. We&apos;ll extract its text so the
          next version can identify topics with AI.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-2 block text-sm font-medium text-slate-200">
                Syllabus PDF
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  setError("");
                  setResult(null);
                }}
                className="block w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
              />
            </label>

            <button
              type="submit"
              disabled={loading || !file}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Extracting..." : "Extract PDF"}
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            V0.1 limit: PDF files up to 10 MB. Text-based PDFs work best.
          </p>

          {error && (
            <div className="mt-5 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
              {error}
            </div>
          )}
        </form>

        {result && (
          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">PDF extracted successfully</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {result.fileName} · {result.pages} page
                  {result.pages === 1 ? "" : "s"} · {result.characters.toLocaleString()} characters
                </p>
              </div>
              <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300">
                Ready for AI
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={analyzeSyllabus}
                disabled={analyzing}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzing ? "Starting AI analysis..." : "Analyze Syllabus with AI"}
              </button>
              <span className="text-xs text-slate-500">
                Gemini will identify subjects, units, and topics. Analysis runs in the background.
              </span>
            </div>

            {analysis && (
              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="text-lg font-semibold">AI syllabus structure</h3>
                <div className="mt-5 space-y-6">
                  {analysis.subjects?.map((subject, subjectIndex) => (
                    <div key={subjectIndex} className="rounded-xl border border-slate-800 p-4">
                      <h4 className="font-semibold">
                        {subject.name}
                        {subject.code ? <span className="ml-2 text-sm text-slate-500">({subject.code})</span> : null}
                      </h4>
                      <div className="mt-4 space-y-4">
                        {subject.units?.map((unit, unitIndex) => (
                          <div key={unitIndex}>
                            <p className="text-sm font-medium text-slate-300">{unit.name}</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
                              {unit.topics?.map((topic, topicIndex) => (
                                <li key={topicIndex}>{topic}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-slate-300">
                Extracted text
              </h3>
              <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-5 text-sm leading-6 text-slate-300">
                {result.text || "No selectable text was found in this PDF."}
              </pre>
            </div>
          </section>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          {["PDF Analysis", "AI Quiz", "Weak Topic Detection", "Study Plan"].map(
            (item) => (
              <span
                key={item}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300"
              >
                {item}
              </span>
            )
          )}
        </div>
      </section>
    </main>
  );
}
