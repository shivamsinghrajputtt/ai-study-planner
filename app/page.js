"use client";

import { useRef, useState } from "react";

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
  const [weakTopics, setWeakTopics] = useState([]);
  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState(2);
  const [studyPlan, setStudyPlan] = useState(null);
  const [studyPlanLoading, setStudyPlanLoading] = useState(false);
  const [completedDays, setCompletedDays] = useState({});
  const [selectedPlanDay, setSelectedPlanDay] = useState(1);
  const extractRequestRef = useRef(false);
  const analyzeRequestRef = useRef(false);
  const quizRequestRef = useRef(false);
  const studyPlanRequestRef = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (extractRequestRef.current || loading) return;

    const selectedFile = event.currentTarget.elements.namedItem("file")?.files?.[0];

    if (!selectedFile) {
      setError("Please select a PDF first.");
      return;
    }

    extractRequestRef.current = true;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not extract the PDF.");
      }

      setError("");
      setResult(data);
      setAnalysis(null);
      setSelectedSubjectIndex("");
      setSelectedUnitIndex("");
      setQuiz(null);
      setSelectedAnswers({});
      setQuizSubmitted(false);
      setWeakTopics([]);
      setStudyPlan(null);
      setCompletedDays({});
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      extractRequestRef.current = false;
      setLoading(false);
    }
  }

  async function analyzeSyllabus() {
    if (analyzeRequestRef.current || analyzing) return;

    if (!result?.text) {
      setError("Please extract a PDF first.");
      return;
    }

    analyzeRequestRef.current = true;
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

      if (!response.ok) {
        throw new Error(data.error || "Could not analyze the syllabus.");
      }

      if (!data?.subjects) {
        throw new Error("AI returned an invalid syllabus structure.");
      }

      setAnalysis(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      analyzeRequestRef.current = false;
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
    if (quizRequestRef.current || quizLoading) return;

    if (!selectedSubject || !selectedUnit?.topics?.length) {
      setError("Please select a subject and unit first.");
      return;
    }

    quizRequestRef.current = true;
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

      if (!Array.isArray(data?.questions) || data.questions.length === 0) {
        throw new Error("AI returned an empty quiz.");
      }

      setQuiz(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      quizRequestRef.current = false;
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

    const topicCounts = quiz.questions.reduce((counts, question, index) => {
      if (selectedAnswers[index] !== question.correctAnswer) {
        counts[question.topic] = (counts[question.topic] || 0) + 1;
      }
      return counts;
    }, {});

    setWeakTopics(
      Object.entries(topicCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([topic, wrongCount]) => ({ topic, wrongCount }))
    );
  }

  const quizScore =
    quiz?.questions?.reduce(
      (score, question, index) =>
        score + (selectedAnswers[index] === question.correctAnswer ? 1 : 0),
      0
    ) || 0;

  async function generateStudyPlan() {
    if (studyPlanRequestRef.current || studyPlanLoading) return;

    if (!quizSubmitted) {
      setError("Please submit the quiz before creating a study plan.");
      return;
    }

    if (!selectedSubject || !selectedUnit?.topics?.length) {
      setError("Please select a subject and unit first.");
      return;
    }

    if (!examDate) {
      setError("Please select your exam date.");
      return;
    }

    studyPlanRequestRef.current = true;
    setStudyPlanLoading(true);
    setError("");
    setStudyPlan(null);

    try {
      const response = await fetch("/api/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: selectedSubject.name,
          unit: selectedUnit.name,
          topics: selectedUnit.topics,
          weakTopics,
          examDate,
          dailyHours,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not generate the study plan.");
      }

      if (!Array.isArray(data?.days) || data.days.length === 0) {
        throw new Error("AI returned an empty study plan.");
      }

      setStudyPlan(data);
      setCompletedDays({});
      setSelectedPlanDay(1);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      studyPlanRequestRef.current = false;
      setStudyPlanLoading(false);
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
                name="file"
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
              disabled={loading}
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
                          <>
                            <p className="mt-3 text-sm text-slate-400">
                              {question.explanation}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                              Topic: {question.topic}
                            </p>
                          </>
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
                      <>
                        <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                          <p className="text-2xl font-bold">
                            Score: {quizScore} / {quiz.questions.length}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {Math.round((quizScore / quiz.questions.length) * 100)}%
                          </p>
                        </div>

                        <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-5">
                        <h4 className="font-semibold text-amber-200">Weak Topic Detection</h4>
                        {weakTopics.length > 0 ? (
                          <>
                            <p className="mt-1 text-sm text-slate-400">
                              Review these syllabus topics based on your incorrect answers.
                            </p>
                            <div className="mt-4 space-y-2">
                              {weakTopics.map(({ topic, wrongCount }) => (
                                <div
                                  key={topic}
                                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
                                >
                                  <span className="text-sm text-slate-200">{topic}</span>
                                  <span className="text-xs text-amber-300">
                                    {wrongCount} wrong
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-emerald-300">
                            No weak topics detected in this quiz. Great job!
                          </p>
                        )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {quizSubmitted && selectedSubject && selectedUnit && (
                  <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-5">
                    <h3 className="text-lg font-semibold">Personalized Study Plan</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Turn your quiz performance into a day-by-day revision plan.
                    </p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label>
                        <span className="mb-2 block text-sm font-medium text-slate-300">
                          Exam date
                        </span>
                        <input
                          type="date"
                          value={examDate}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(event) => {
                            setExamDate(event.target.value);
                            setStudyPlan(null);
                            setError("");
                          }}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white"
                        />
                      </label>

                      <label>
                        <span className="mb-2 block text-sm font-medium text-slate-300">
                          Daily study time
                        </span>
                        <select
                          value={dailyHours}
                          onChange={(event) => {
                            setDailyHours(Number(event.target.value));
                            setStudyPlan(null);
                          }}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white"
                        >
                          <option value={1}>1 hour/day</option>
                          <option value={1.5}>1.5 hours/day</option>
                          <option value={2}>2 hours/day</option>
                          <option value={3}>3 hours/day</option>
                          <option value={4}>4 hours/day</option>
                          <option value={5}>5 hours/day</option>
                          <option value={6}>6 hours/day</option>
                          <option value={8}>8 hours/day</option>
                        </select>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={generateStudyPlan}
                      disabled={studyPlanLoading || !examDate}
                      className="mt-5 rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {studyPlanLoading ? "Creating Study Plan..." : studyPlan ? "Regenerate Study Plan" : "Create Study Plan"}
                    </button>

                    {studyPlan && (
                      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Plan</p>
                            <p className="mt-1 text-lg font-semibold">{studyPlan.daysAvailable} days</p>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Daily time</p>
                            <p className="mt-1 text-lg font-semibold">{studyPlan.dailyHours} hours</p>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs uppercase tracking-wide text-slate-500">Progress</p>
                              <span className="text-xs text-slate-400">
                                {Object.values(completedDays).filter(Boolean).length}/{studyPlan.days?.length || 0}
                              </span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{
                                  width: `${studyPlan.days?.length ? (Object.values(completedDays).filter(Boolean).length / studyPlan.days.length) * 100 : 0}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
                          <p className="text-sm leading-6 text-slate-300">{studyPlan.summary}</p>
                        </div>

                        <div className="mt-5">
                          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Your study days</p>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {studyPlan.days?.map((day) => (
                              <button
                                key={day.day}
                                type="button"
                                onClick={() => setSelectedPlanDay(day.day)}
                                className={`min-w-[78px] rounded-xl border px-3 py-2 text-left transition ${
                                  selectedPlanDay === day.day
                                    ? "border-white bg-white text-slate-950"
                                    : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                                }`}
                              >
                                <span className="block text-xs font-medium">Day {day.day}</span>
                                <span className="mt-1 block text-[11px] opacity-70">{day.date.slice(5)}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {(() => {
                          const activeDay =
                            studyPlan.days?.find((day) => day.day === selectedPlanDay) ||
                            studyPlan.days?.[0];

                          if (!activeDay) return null;

                          return (
                            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-5">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-slate-500">Day {activeDay.day}</p>
                                  <h4 className="mt-1 text-xl font-semibold">{activeDay.focus}</h4>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {activeDay.date} · {activeDay.durationMinutes} min
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCompletedDays((current) => ({
                                      ...current,
                                      [activeDay.day]: !current[activeDay.day],
                                    }))
                                  }
                                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                                    completedDays[activeDay.day]
                                      ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                                      : "border-slate-700 text-slate-300 hover:border-slate-500"
                                  }`}
                                >
                                  {completedDays[activeDay.day] ? "✓ Completed" : "Mark Complete"}
                                </button>
                              </div>

                              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Topics</p>
                                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                                    {activeDay.topics?.map((topic, index) => <li key={index}>{topic}</li>)}
                                  </ul>
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tasks</p>
                                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                                    {activeDay.tasks?.map((task, index) => <li key={index}>{task}</li>)}
                                  </ul>
                                </div>
                              </div>

                              <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
                                <button
                                  type="button"
                                  disabled={activeDay.day <= 1}
                                  onClick={() => setSelectedPlanDay(activeDay.day - 1)}
                                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  ← Previous
                                </button>
                                <span className="text-xs text-slate-500">{activeDay.day} of {studyPlan.days?.length}</span>
                                <button
                                  type="button"
                                  disabled={activeDay.day >= studyPlan.days.length}
                                  onClick={() => setSelectedPlanDay(activeDay.day + 1)}
                                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Next →
                                </button>
                              </div>
                            </div>
                          );
                        })()}
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
