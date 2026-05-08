# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NanoQuiz (OpenQuiz) is a plug-n-play quiz platform. Organizations fork it, drop in JSON question files, configure env vars, and deploy a secure, timed 10-question assessment with single-attempt enforcement and leaderboard.

**Current state: Fully implemented.** Backend and frontend source code complete with tests. CI/CD pipeline configured. See `docs/tasks/` for task breakdowns. When source code changes significantly, update this section.

## Tech Stack

- **Frontend:** React 19.2 + Vite + TypeScript + Tailwind CSS → Vercel
- **Backend:** Node.js 24 + Express.js 5 + TypeScript → Render
- **Database:** PostgreSQL via Supabase (`pg` driver, NOT an ORM)
- **Auth:** Google OAuth 2.0 (`@react-oauth/google` client, `google-auth-library` server)
- **Testing:** Vitest (both frontend and backend)

## Architecture

```
Frontend (Vercel) ←→ Backend API (Render) ←→ PostgreSQL (Supabase)
     :5173                  :3000                   Supabase host
```

### Backend Structure (`backend/src/`)
- `index.ts` — Express app entry: CORS, morgan HTTP logging, auth middleware chain, graceful shutdown
- `routes/auth.ts` — Google OAuth verify + upsert user + issue JWT. Onboarding (employee_id). Domain restriction via `RESTRICT_DOMAIN`.
- `routes/quiz.ts` — Status, start (transaction: allocate 6 FAQ + 4 trivia), get question (sequential, no correct_opt), answer (Q10 triggers scoring in transaction)
- `routes/leaderboard.ts` — Ranked scores (score DESC, duration ASC)
- `routes/health.ts` — DB connectivity check
- `middleware/auth.ts` — JWT verify, attaches `userId` to request
- `middleware/cors.ts` — CORS + OPTIONS preflight
- `middleware/deadline.ts` — 403 if past `EVENT_DEADLINE_ISO` (exempt: status, leaderboard)
- `db/index.ts` — `pg.Pool` with SSL, `query<T>()` helper, `getClient()` for transactions
- `utils/logger.ts` — Structured JSON logger (info/warn/error to stdout/stderr)
- `seed.ts` — Idempotent question seeder from `data/*.json` files

### Frontend Structure (`frontend/src/`)
- `main.tsx` — Entry, `GoogleOAuthProvider` wrapper
- `App.tsx` — Lazy-loaded routes with Suspense + ErrorBoundary
- `contexts/AuthContext.tsx` — Auth state (user, token, quizStatus, onboarding), localStorage persistence, auto-fetches `/quiz/status` on mount
- `api/client.ts` — Axios with JWT interceptor, 401 auto-logout, custom errors (`ApiError`, `EventConcludedError`)
- `pages/` — `Login`, `Onboarding`, `QuizContainer` (start screen), `Question`, `CompletionScreen`, `LeaderboardPage`
- `components/` — `QuestionDisplay`, `StartQuizButton`, `ProtectedRoute` (gate with `requireEmployeeId`/`requireQuizStarted`/`requireQuizCompleted`), `ErrorBoundary`, `ErrorMessage`, `EventConcluded`, `OfflineBanner`
- `hooks/` — `useAuth` (context consumer), `useOfflineStatus`

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

## Commands

```bash
# Backend
cd backend
npm run dev          # tsx watch with hot reload (port 3000)
npm run build        # tsc compile
npm start            # Production: node dist/index.js
npm run seed         # Idempotent question seeding from JSON files
npm run cleanup-db   # Drop all quiz data (users, sessions) but keep questions
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # vitest

# Frontend
cd frontend
npm run dev          # Vite dev server (port 5173)
npm run build        # tsc -b && vite build
npm run preview      # Preview production build
npm run lint         # ESLint
npm run typecheck    # tsc -b
npm test             # vitest + @testing-library/react

# Database
psql $SUPABASE_DB_URL -f docs/data/schema.sql   # Apply schema

# Pre-deployment validation
npx tsx scripts/validate-env.ts     # Check all required env vars are set
npx tsx scripts/validate-schema.ts  # Verify DB schema matches expected (needs SUPABASE_DB_URL)
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
| `FRONTEND_URL` | Yes | Vercel URL (CORS origin) |
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

## Test Infrastructure

- **Backend:** Vitest + `supertest` for HTTP-level route tests. JWT tokens generated per test via `jsonwebtoken`.
- **Frontend:** Vitest + `@testing-library/react` (jsdom). MSW (`msw`) mocks API responses in tests.
- **CI:** `.github/workflows/ci.yml` — lint → typecheck → test → build (backend + frontend). On main: also validate deploy (env vars + schema). Currently `workflow_dispatch` only (push/PR triggers commented out).

## Logging

Backend uses structured JSON logging via `backend/src/utils/logger.ts`. Morgan HTTP logs piped through `logger.info` with `{ source: 'http' }` context. Errors write to stderr, info/warn to stdout. All log entries include ISO timestamp, level, and message.

## Repository Scripts

`scripts/` contains pre-deployment tooling (run with `npx tsx`):
- `validate-env.ts` — Checks all required env vars are set
- `validate-schema.ts` — Verifies DB schema has expected tables, columns, and triggers
- `pre-deploy.ts` — Orchestrates validation and build
- `test-db-connection.ts` — Simple DB connectivity smoke test

## Key Reference Documents

- `docs/PRD.md` — Product requirements (full spec)
- `docs/api-docs/API.md` — Complete API documentation with request/response schemas
- `docs/data/schema.sql` — Canonical database DDL (tables, constraints, triggers, indexes)
- `docs/tasks/FRONTEND_TASKS.md` — 17 frontend tasks across 6 phases
- `docs/tasks/BACKEND_TASKS.md` — 18 backend tasks across 7 phases
- `docs/tasks/DEVOPS_TASKS.md` — 13 DevOps tasks across 5 phases
