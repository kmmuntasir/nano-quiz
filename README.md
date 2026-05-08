# NanoQuiz

Plug-n-play quiz platform. Fork, drop in JSON questions, configure Google OAuth, deploy a secure, timed 10-question assessment with single-attempt enforcement and leaderboard.

## Tech Stack

| Layer | Technology | Host |
|-------|-----------|------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS | Vercel |
| Backend | Node.js 24 + Express 5 + TypeScript | Render |
| Database | PostgreSQL (Supabase) | Supabase |
| Auth | Google OAuth 2.0 | — |
| Testing | Vitest | — |

## Prerequisites

- Node.js 24+
- npm 10+
- PostgreSQL database (Supabase recommended)
- Google OAuth 2.0 credentials ([Google Cloud Console](https://console.cloud.google.com/))

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/your-org/nano-quiz.git
cd nano-quiz
npm install          # Root-level dev dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Set up environment variables

Copy the example files and fill in your values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

#### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `FRONTEND_URL` | Yes | — | Frontend URL for CORS (e.g., `http://localhost:5173`) |
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `JWT_SECRET` | Yes | — | Secret for signing app JWTs |
| `SUPABASE_DB_URL` | Yes | — | PostgreSQL connection string |
| `RESTRICT_DOMAIN` | No | — | Restrict login to email domain (e.g., `@company.com`) |
| `EVENT_DEADLINE_ISO` | No | — | ISO 8601 deadline. Unset = open indefinitely |
| `TRACK_PER_QUESTION_TIME` | No | `false` | Record per-question view timestamps |

#### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | Yes | Backend API URL (e.g., `http://localhost:3000/api`) |
| `VITE_GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |

### 3. Set up the database

Apply the schema to your PostgreSQL database:

```bash
psql $SUPABASE_DB_URL -f docs/data/schema.sql
```

Schema creates three tables: `users`, `questions`, `user_sessions` with triggers for single-attempt enforcement and auto-updating timestamps.

### 4. Seed questions

Place question files in `backend/data/`:

- `faq_questions.json` — Company/policy questions
- `trivia_questions.json` — General knowledge questions

JSON format per question:

```json
{
  "question": "What is the company remote work policy?",
  "options": {
    "A": "Fully remote",
    "B": "Hybrid 3 days/week",
    "C": "In-office only",
    "D": "Flexible based on role"
  },
  "correct_option": "B"
}
```

Run the seed script:

```bash
cd backend && npm run seed
```

Seeding is idempotent — re-running won't create duplicates. Each quiz randomly selects 6 FAQ + 4 trivia questions per user.

### 5. Start development servers

```bash
# Backend (port 3000)
cd backend && npm run dev

# Frontend (port 5173) — in a separate terminal
cd frontend && npm run dev
```

## Project Structure

```
nano-quiz/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express app entry point
│   │   ├── seed.ts           # Question seeding script
│   │   ├── db/               # PostgreSQL connection pool
│   │   ├── routes/           # API route handlers
│   │   ├── middleware/       # Auth, CORS, deadline checks
│   │   └── test/             # Backend test files
│   ├── data/
│   │   ├── faq_questions.json
│   │   └── trivia_questions.json
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx          # Entry point (GoogleOAuthProvider)
│   │   ├── App.tsx           # Route definitions
│   │   ├── api/              # Axios client
│   │   ├── components/       # Shared UI components
│   │   ├── contexts/         # React contexts (Auth)
│   │   ├── hooks/            # Custom hooks
│   │   ├── pages/            # Route-level page components
│   │   └── test/             # Frontend test files
│   ├── public/
│   ├── .env.example
│   └── package.json
├── docs/
│   ├── PRD.md                # Product requirements
│   ├── api-docs/API.md       # Full API documentation
│   ├── data/schema.sql       # Database DDL (tables, triggers, indexes)
│   └── tasks/                # Task breakdowns (frontend, backend, devops)
├── CLAUDE.md                 # AI agent instructions
└── README.md
```

## Available Commands

### Backend

```bash
cd backend
npm run dev          # Development with hot reload (tsx watch)
npm run build        # TypeScript compile
npm start            # Production server
npm run seed         # Load questions into database
npm test             # Run tests (Vitest)
```

### Frontend

```bash
cd frontend
npm run dev          # Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint
npm test             # Run tests (Vitest + Testing Library)
```

## API Overview

All `/api/*` endpoints (except auth) require Bearer JWT in Authorization header.

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `POST /api/auth/google` | Public | No | Verify Google JWT, issue app JWT |
| `POST /api/auth/onboard` | JWT | Yes | Save employee ID (first-time) |
| `GET /api/quiz/status` | JWT | Yes | Check quiz progress |
| `POST /api/quiz/start` | JWT | Yes | Start quiz (allocate 10 questions) |
| `GET /api/quiz/question/:seq` | JWT | Yes | Fetch question by sequence (1–10) |
| `POST /api/quiz/answer` | JWT | Yes | Submit answer (Q10 triggers scoring) |
| `GET /api/leaderboard` | JWT | Yes | Ranked scores |
| `GET /health` | Public | No | Database connectivity check |

Full API documentation: [`docs/api-docs/API.md`](docs/api-docs/API.md)

## Key Design Constraints

- **No backtracking** — Questions shown sequentially, cannot revisit answered questions
- **Server-side timing** — All timestamps from PostgreSQL `NOW()`, client timestamps ignored
- **Single attempt** — Enforced at application and database level (trigger prevents re-entry)
- **No correct answers exposed** — `correct_opt` never sent to frontend
- **Session resumption** — `/api/quiz/status` returns current position for crash recovery
- **JWT: 2-hour expiry** — Accommodates quiz duration + recovery buffer

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Run all tests from root
(cd backend && npm test) && (cd frontend && npm test)
```

## Deployment

### Frontend (Vercel)

1. Connect repo to Vercel
2. Set **root directory**: `frontend`
3. Build command and output directory auto-detected from `vercel.json`
4. Add environment variables in Vercel dashboard

### Backend (Render)

1. Connect repo to Render
2. Set **build command**: `cd backend && npm install`
3. Set **start command**: `cd backend && npm start`
4. Add environment variables in Render dashboard

## Database Schema

Canonical DDL at [`docs/data/schema.sql`](docs/data/schema.sql).

Tables:
- **`users`** — Google OAuth identity, employee ID, score, timing
- **`questions`** — FAQ/trivia bank with 4 options per question
- **`user_sessions`** — Per-user question allocation, sequential answers, per-question timing

Key constraints:
- `UNIQUE (user_id, sequence_order)` — one answer per question slot
- `UNIQUE (user_id, question_id)` — no duplicate question assignment
- Trigger `prevent_multiple_quiz_attempts` blocks re-entry after completion

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** → **Create OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add authorized JavaScript origins:
   - `http://localhost:5173` (development)
   - Your Vercel URL (production)
7. Copy the Client ID to both `backend/.env` (`GOOGLE_CLIENT_ID`) and `frontend/.env` (`VITE_GOOGLE_CLIENT_ID`)

## Contributing

1. Create a feature branch: `feature/NANO-<number>-description`
2. Make changes with tests
3. Submit a pull request for review

## License

See [LICENSE](LICENSE).
