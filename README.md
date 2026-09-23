# AI Study Planner

> Turn a syllabus PDF into an AI-powered, topic-focused study experience.

AI Study Planner is a full-stack learning project that transforms a university syllabus PDF into a structured academic map and then generates unit-specific quizzes from the extracted syllabus content.

The project is being developed incrementally — starting with a working PDF → AI analysis → quiz pipeline and evolving toward personalized weak-topic detection and study-plan generation.

## 🚀 Current Status

**Working: V0.2 — AI Syllabus Analysis + Quiz**

The current end-to-end flow is:

```text
Syllabus PDF
    ↓
PDF text extraction
    ↓
AI syllabus analysis
    ↓
Subjects → Units → Topics
    ↓
Select subject + unit
    ↓
AI-generated quiz
    ↓
Answer checking + explanations
    ↓
Score
```

### Verified capabilities

- 📄 Upload a syllabus PDF
- 🔍 Extract text from PDF files
- 🤖 Analyze syllabus structure with Gemini AI
- 📚 Identify subjects, course codes, units and topics
- 🎯 Generate a quiz from a selected subject and unit
- ✅ Check answers automatically
- 💡 Show explanations for answers
- 📊 Calculate quiz score
- 🔐 Keep the Gemini API key server-side using environment variables

A real syllabus test has been completed successfully: a **27-page PDF with 48,918 extracted characters** was processed, structured with AI, and used to generate a working quiz.

## 🧠 Why this project?

Most study tools start with generic questions. AI Study Planner starts with the student's **actual syllabus**.

The goal is to build a pipeline that can answer:

> "What do I need to study, what am I weak at, and what should I study next?"

The planned product flow is:

```text
PDF Syllabus
    ↓
Topics
    ↓
Quiz
    ↓
Weak Topics
    ↓
Personalized Study Plan
    ↓
Progress Tracking
```

## 🛠️ Tech Stack

### Frontend
- Next.js
- React
- Tailwind CSS
- JavaScript

### Backend
- Next.js Route Handlers
- Node.js runtime
- PDF parsing with `pdf-parse`

### AI
- Google Gemini API
- `@google/genai`
- Gemini 3.5 Flash-Lite
- Structured JSON output for syllabus analysis
- AI-generated multiple-choice quizzes

### Development & Deployment
- Git
- GitHub
- GitHub Codespaces
- Environment variables for secrets
- Vercel planned for deployment

## 🏗️ Architecture

```text
┌───────────────────────┐
│     Syllabus PDF      │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  /api/extract-pdf     │
│    PDF → Text         │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ /api/analyze-syllabus │
│  Gemini AI Analysis   │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Subjects / Units /    │
│ Topics JSON structure  │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  /api/generate-quiz   │
│      Gemini AI        │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Quiz → Answers → Score│
└───────────────────────┘
```

## 📂 Project Structure

```text
ai-study-planner/
├── app/
│   ├── api/
│   │   ├── analyze-syllabus/
│   │   │   └── route.js
│   │   ├── extract-pdf/
│   │   │   └── route.js
│   │   └── generate-quiz/
│   │       └── route.js
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── components/
├── lib/
├── public/
├── .env.example
├── .gitignore
├── next.config.mjs
├── package.json
└── README.md
```

## 🔒 Security

API credentials are not committed to the repository.

The application uses:

```text
.env.local
    ↓
GEMINI_API_KEY
    ↓
Server-side API routes
```

A placeholder `.env.example` is provided for setup.

## 🧪 Example

A syllabus can be transformed into a structure such as:

```text
Operating System
├── Unit 1
├── Unit 2
│   ├── Process Management
│   ├── Scheduling
│   └── Threads
├── Unit 3
│   └── Memory Management
└── ...
```

The student can then select a unit and generate a focused quiz instead of receiving unrelated questions.

## 🗺️ Roadmap

### V0.1 — PDF Extraction ✅
- PDF upload
- Text extraction
- File validation
- Extraction result display

### V0.2 — AI Syllabus Analysis + Quiz ✅
- AI subject detection
- Unit/topic extraction
- Structured AI output
- Unit-specific quiz generation
- Answer validation
- Explanations
- Score calculation

### V0.3 — Weak Topic Detection 🔜
- Map incorrect answers to topics
- Identify weak topics
- Show weakness summary
- Track quiz performance

### V0.4 — Personalized Study Plan 🔜
- Exam date
- Available study time
- Weak topics
- Topic priority
- Day-by-day study plan

### V1.0 — Personal Study Dashboard 🔜
- Authentication
- Supabase/Postgres
- Progress tracking
- Quiz history
- Study streaks
- Personalized recommendations

## 💡 Engineering Goals

This project is intentionally being built as a real product rather than a single AI demo.

Key engineering goals:

- Keep AI outputs structured and predictable
- Separate UI, API and AI responsibilities
- Validate user input at API boundaries
- Keep secrets out of source control
- Build features incrementally and verify each version
- Design the data flow so future progress tracking can be added without rewriting the core pipeline

## 👨‍💻 Author

**Shivam Kumar Singh**

B.Tech Computer Science & Engineering

This project is being developed as a hands-on exploration of **AI engineering, full-stack development, API integration, structured AI outputs, and product development**.

---

⭐ If you find the project interesting, consider starring the repository and following its development.
