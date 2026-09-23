"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState("");
  const [selectedUnitIndex, setSelectedUnitIndex] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [quiz, setQuiz] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

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
      setSelectedSubjectIndex("");
      setSelectedUnitIndex("");
      setQuiz(null);
      setSelectedAnswers({});
      setQuizSubmitted(false);
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

  const selectedSubject =
    selectedSubjectIndex === "" ? null : analysis?.subjects?.[Number(selectedSubjectIndex)];

  const selectedUnit =
    selectedSubject && selectedUnitIndex !== ""
      ? selectedSubject.units?.[Number(selectedUnitIndex)]
      : null;

  async function generateQuiz() {
    if (!selectedSubject || !selectedUnit?.topics?.length) {
      setError("Please select a subject and unit first.");
      return;
    }

    setQuizLoading(true);
    setError("");
    setQuiz(null);
    setSelectedAnswers({});
    setQuizSubmitted(false);

    try {
      const response = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: selectedSubject.name,
          unit: selectedUnit.name,
          topics: selectedUnit.topics,
          numberOfQuestions: questionCount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not generate the quiz.");
      }

      setQuiz(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setQuizLoading(false);
    }
  }

  function submitQuiz() {
    if (!quiz) return;

    const unanswered = quiz.questions.some(
      (_, index) => selectedAnswers[index] === undefined
    );

    if (unanswered) {
      setError("Please answer every question before submitting.");
      return;
    }

    setError("");
    setQuizSubmitted(true);
  }

  const quizScore =
    quiz?.questions?.reduce(
      (score, question, index) =>
        score + (selectedAnswers[index] === question.correctAnswer ? 1 : 0),
      0
    ) || 0;

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
                Gemini will identify subjects, units, and topics.
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

            {analysis?.subjects?.length > 0 && (
              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="text-lg font-semibold">Generate a Quiz</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Choose one subject and unit. The AI will create questions only from that unit&apos;s topics.
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <label>
                    <span className="mb-2 block text-sm font-medium text-slate-300">Subject</span>
                    <select
                      value={selectedSubjectIndex}
                      onChange={(event) => {
                        setSelectedSubjectIndex(event.target.value);
                        setSelectedUnitIndex("");
                        setQuiz(null);
                        setSelectedAnswers({});
                        setQuizSubmitted(false);
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white"
                    >
                      <option value="">Select subject</option>
                      {analysis.subjects.map((subject, index) => (
                        <option key={index} value={index}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-medium text-slate-300">Unit</span>
                    <select
                      value={selectedUnitIndex}
                      onChange={(event) => {
                        setSelectedUnitIndex(event.target.value);
                        setQuiz(null);
                        setSelectedAnswers({});
                        setQuizSubmitted(false);
                      }}
                      disabled={!selectedSubject}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white disabled:opacity-50"
                    >
                      <option value="">Select unit</option>
                      {selectedSubject?.units?.map((unit, index) => (
                        <option key={index} value={index}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="mb-2 block text-sm font-medium text-slate-300">Questions</span>
                    <select
                      value={questionCount}
                      onChange={(event) => setQuestionCount(Number(event.target.value))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white"
                    >
                      <option value={5}>5 questions</option>
                      <option value={10}>10 questions</option>
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={generateQuiz}
                  disabled={quizLoading || !selectedUnit}
                  className="mt-5 rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {quizLoading ? "Generating Quiz..." : "Generate Quiz"}
                </button>

                {quiz && (
                  <div className="mt-6 space-y-5">
                    <div>
                      <h4 className="text-base font-semibold">
                        {quiz.subject} · {quiz.unit}
                      </h4>
                      <p className="mt-1 text-sm text-slate-500">
                        {quiz.questions.length} questions
                      </p>
                    </div>

                    {quiz.questions.map((question, questionIndex) => (
                      <div
                        key={questionIndex}
                        className="rounded-xl border border-slate-800 p-4"
                      >
                        <p className="font-medium text-slate-200">
                          {questionIndex + 1}. {question.question}
                        </p>

                        <div className="mt-4 space-y-2">
                          {question.options.map((option, optionIndex) => {
                            const isSelected = selectedAnswers[questionIndex] === optionIndex;
                            const isCorrect = question.correctAnswer === optionIndex;
                            const showResult = quizSubmitted;

                            return (
                              <label
                                key={optionIndex}
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                                  showResult && isCorrect
                                    ? "border-emerald-700 bg-emerald-950/30 text-emerald-200"
                                    : showResult && isSelected
                                      ? "border-red-700 bg-red-950/30 text-red-200"
                                      : "border-slate-800 hover:border-slate-600"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`question-${questionIndex}`}
                                  checked={isSelected}
                                  disabled={quizSubmitted}
                                  onChange={() =>
                                    setSelectedAnswers((current) => ({
                                      ...current,
                                      [questionIndex]: optionIndex,
                                    }))
                                  }
                                  className="mt-1"
                                />
                                <span>{option}</span>
                              </label>
                            );
                          })}
                        </div>

                        {quizSubmitted && (
                          <p className="mt-3 text-sm text-slate-400">
                            {question.explanation}
                          </p>
                        )}
                      </div>
                    ))}

                    {!quizSubmitted ? (
                      <button
                        type="button"
                        onClick={submitQuiz}
                        className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-200"
                      >
                        Submit Quiz
                      </button>
                    ) : (
                      <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                        <p className="text-2xl font-bold">
                          Score: {quizScore} / {quiz.questions.length}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {Math.round((quizScore / quiz.questions.length) * 100)}%
                        </p>
                      </div>
                    )}
                  </div>
                )}
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
