# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NanoQuiz (OpenQuiz) is a plug-n-play quiz platform. Organizations fork it, drop in JSON question files, configure env vars, and deploy a secure, timed 10-question assessment with single-attempt enforcement and leaderboard.

**Current state: Documentation/specification only. No source code implemented yet.** All planning artifacts exist in `docs/`. Implementation follows task breakdowns in `docs/tasks/`. When any source code is modified, update this section to reflect the current state of the codebase.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS → Netlify
- **Backend:** Node.js 20 + Express.js + TypeScript → Render
- **Database:** PostgreSQL via Supabase (`pg` driver, NOT an ORM)
- **Auth:** Google OAuth 2.0 (`@react-oauth/google` client, `google-auth-library` server)
- **Testing:** Vitest (both frontend and backend)

## Architecture

```
Frontend (Netlify) ←→ Backend API (Render) ←→ PostgreSQL (Supabase)
     :5173                  :3000                   Supabase host
```

### Backend Structure (`backend/src/`)
- `index.ts` — Entry point, Express app setup, CORS, middleware chain
- `routes/` — Route handlers: `auth.ts`, `quiz.ts`, `leaderboard.ts`, `health.ts`
- `middleware/` — JWT validation, deadline check, CORS config
- `services/` — Business logic for quiz flow, scoring, user management
- `db/` — PostgreSQL connection pool (`pg.Pool`)
- `data/` — JSON seed files (`faq_questions.json`, `trivia_questions.json`)

### Frontend Structure (`frontend/src/`)
- `main.tsx` — Entry, wrapped in `GoogleOAuthProvider`
- `contexts/AuthContext.tsx` — Auth state (user, token, onboarding), localStorage persistence
- `api/client.ts` — Axios instance with JWT interceptor
- `pages/` — Route-level components (Login, Onboarding, Quiz, Completion, Leaderboard)
- `components/` — Shared UI (QuizContainer, QuestionDisplay, StartQuizButton)
- `hooks/` — Custom hooks (`useAuth`, `useQuiz`)

### Database Schema (`docs/data/schema.sql`)
Three tables: `users`, `questions`, `user_sessions`
- `users` — Google OAuth identity, employee_id, score, timing (started_at, completed_at)
- `questions` — FAQ/trivia bank, options as columns (opt_a..opt_d), correct_opt hidden from API
- `user_sessions` — Per-user question allocation, sequential answers, per-question timing
- DB trigger `prevent_multiple_quiz_attempts` enforces single-attempt at database level

## Key Design Constraints

1. **No backtracking** — Users see questions sequentially, cannot revisit answered questions. API enforces this via sequential access check (403 for non-current sequence).
2. **Server-side timing** — All timestamps use PostgreSQL `NOW()`. Client timestamps ignored. Prevents clock manipulation.
3. **Single attempt** — Enforced at both application level (started_at check) and database level (trigger).
4. **No correct answers exposed** — `correct_opt` never sent to frontend. Scoring happens server-side on Q10 answer submission.
5. **Session resumption** — If browser crashes, `/api/quiz/status` returns `current_sequence` to resume from first unanswered question.
6. **Event deadline** — Optional `EVENT_DEADLINE_ISO` env var. Status and leaderboard endpoints exempt from deadline check.
7. **JWT: 2-hour expiry** — Accommodates quiz duration + crash recovery buffer.

## API Overview

All `/api/*` endpoints (except auth) require Bearer JWT. Base URL: `VITE_API_BASE_URL`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/auth/google` | Public | Verify Google JWT, issue app JWT |
| `POST /api/auth/onboard` | Auth | Save employee_id (first-time) |
| `GET /api/quiz/status` | Auth | Progress check (deadline exempt) |
| `POST /api/quiz/start` | Auth | Allocate 6 FAQ + 4 trivia, start timer |
| `GET /api/quiz/question/:seq` | Auth | Fetch question (no correct_opt, sequential only) |
| `POST /api/quiz/answer` | Auth | Submit answer (Q10 also scores + completes) |
| `GET /api/leaderboard` | Auth | Ranked scores (score DESC, duration ASC) |
| `GET /health` | Public | DB connectivity check |

Full spec: `docs/api-docs/API.md`

## Commands (Post-Implementation)

```bash
# Backend
cd backend
npm run dev          # tsx with hot reload (port 3000)
npm run build        # tsc compile
npm start            # node dist/index.js (production)
npm run seed         # Load JSON questions into DB (idempotent)
npm test             # vitest

# Frontend
cd frontend
npm run dev          # Vite dev server (port 5173)
npm run build        # Production build
npm test             # vitest + @testing-library/react

# Database
psql $SUPABASE_DB_URL -f docs/data/schema.sql   # Apply schema
```

## Question Seeding

JSON files in `backend/data/`:
- `faq_questions.json` — Company/policy questions (category: `faq`)
- `trivia_questions.json` — General knowledge (category: `trivia`)

JSON schema: `{ "question": "...", "options": { "A": "...", "B": "...", "C": "...", "D": "..." }, "correct_option": "B" }`

Seed script maps nested `options` to DB columns (`opt_a`, `opt_b`, `opt_c`, `opt_d`) and `correct_option` to `correct_opt`. Category derived from filename. Idempotent via `ON CONFLICT DO NOTHING`.

## Frontend Route Order

Define `/quiz/complete` **before** `/quiz/:sequence` in route config. React Router matches top-to-bottom — `:sequence` would capture `complete` as a param value.

## Project Slug

`NANO` — used in branch names (`feature/NANO-123-desc`) and commit messages (`NANO-123: message`).

## Environment Variables

### Backend (`backend/.env`)
| Variable | Required | Notes |
|----------|----------|-------|
| `PORT` | No | Default 3000 |
| `FRONTEND_URL` | Yes | Netlify URL (CORS origin) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth |
| `JWT_SECRET` | Yes | App JWT signing |
| `SUPABASE_DB_URL` | Yes | PostgreSQL connection string |
| `RESTRICT_DOMAIN` | No | Email domain restriction |
| `EVENT_DEADLINE_ISO` | No | ISO 8601 deadline. Unset = open indefinitely |
| `TRACK_PER_QUESTION_TIME` | No | Record viewed_at per question |

### Frontend (`frontend/.env`)
| Variable | Required |
|----------|----------|
| `VITE_API_BASE_URL` | Yes |
| `VITE_GOOGLE_CLIENT_ID` | Yes |

## MUST-Follow Rule for AI Agents

The AI Agent MUST write any new documentation, analysis report, or reference file in the `./docs/ai_generated` directory, unless explicitly instructed otherwise.

## Key Reference Documents

- `docs/PRD.md` — Product requirements (full spec)
- `docs/api-docs/API.md` — Complete API documentation with request/response schemas
- `docs/data/schema.sql` — Canonical database DDL (tables, constraints, triggers, indexes)
- `docs/tasks/FRONTEND_TASKS.md` — 17 frontend tasks across 6 phases
- `docs/tasks/BACKEND_TASKS.md` — 18 backend tasks across 7 phases
- `docs/tasks/DEVOPS_TASKS.md` — 13 DevOps tasks across 5 phases
