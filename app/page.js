export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-slate-400">
          AI Study Planner
        </p>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Turn your syllabus into a personalized study plan.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Upload a syllabus, identify important topics, test your knowledge,
          discover weak areas, and build a study plan.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <span className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
            PDF Analysis
          </span>
          <span className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
            AI Quiz
          </span>
          <span className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
            Weak Topic Detection
          </span>
          <span className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
            Study Plan
          </span>
        </div>
      </section>
    </main>
  );
}
