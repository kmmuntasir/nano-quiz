# AGENTS.md

Guidance for opencode when working in this repository. The canonical spec lives in `docs/PRD.md`. Project-specific rules live in `.claude/rules/*.md` — read them as needed for backend/frontend/security/style/testing detail.

## Project

NanoQuiz — a dead simple quiz platform. Users log in with Google OAuth, see a quiz list, take timed multiple-choice quizzes one question at a time, and view scores and leaderboards. Admins (env-identified) manage quizzes and questions.

**Stack:**
- Backend: Node.js 24 + Express.js 5 + TypeScript + `better-sqlite3` (SQLite single-file DB, NO ORM, single process)
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS (separate build)
- Auth: Google OAuth 2.0 (`@react-oauth/google` client, `google-auth-library` server) + app JWT (`jsonwebtoken`, 2h expiry, carries `isAdmin`)
- Testing: Vitest (backend: supertest; frontend: Testing Library + MSW)
- Deploy: single Linux VPS — nginx serves the React build and reverse-proxies `/api` to the Express process, run via PM2/systemd

## Commands

```bash
# Backend (backend/)
npm run dev          # tsx watch, port 3000
npm run build        # tsc
npm start            # node dist/index.js
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # vitest

# Frontend (frontend/)
npm run dev          # Vite, port 5173
npm run build        # tsc -b && vite build
npm run preview      # preview build
npm run lint         # ESLint
npm run typecheck    # tsc -b
npm test             # vitest
```

Always run the relevant `lint` + `typecheck` (+ tests when touched) after making changes.

## Git conventions

- Default branch: `main`. Branches: `feature/NANO-123-desc`, `fix/NANO-123-desc`, etc.
- Commit format: `NANO-123: <subject>` (imperative, lowercase, ≤72 chars). No ticket id → use a type prefix (`feat:`, `fix:`, `docs:`, `chore:`, ...).
- Stage explicit paths only — never `git add -A` / `git add .`. Never push/merge/rebase/amend/force without explicit user approval. Never `--no-verify`.

## Key design constraints (do not violate)

1. **No correct answers exposed** — `correct_opt` is NEVER sent to the frontend. Scoring is server-side, triggered on the final quiz submit.
2. **No mid-way storage** — nothing is persisted until the quiz is completed (single final submit). An abandoned attempt leaves no record; the user restarts from the beginning.
3. **Single participation** — a completed attempt permanently disables the Start button for that user+quiz.
4. **Seed-based question order** — starting a quiz returns a random `seed`; the server derives the per-contestant shuffled question set from it deterministically. Questions are fetched one at a time by sequence.
5. **Client-side timer** — the per-quiz time limit (default 15s) is enforced client-side; on timeout the quiz auto-advances (including the last question, which ends the quiz). Elapsed time is client-reported at submit.
6. **No backtracking** — users cannot revisit answered questions.
7. **Quiz active window** — each quiz has a start/end datetime; a quiz is playable only while the current time is within its window. In-flight attempts continue past the end datetime.
8. **Admin by env** — `ADMIN_EMAILS` (comma-separated) is checked on each request; admin UI is hidden entirely from non-admins. `isAdmin` rides in the JWT.
9. **Backend layering** — route → middleware → db. `db/index.ts` owns the `better-sqlite3` connection. Parameterized/prepared queries only.

## API overview

`POST /api/auth/google`, `GET /api/quizzes`, `POST /api/quizzes/:id/start`, `GET /api/quizzes/:id/question/:seq`, `POST /api/quizzes/:id/submit`, `GET /api/quizzes/:id/leaderboard`, admin endpoints under `/api/admin/quizzes...`, `GET /health`. Full spec: `docs/api-docs/API.md`. All `/api/*` (except auth) require Bearer JWT.

## Skills & agents

- Skills live in `.opencode/skills/*/SKILL.md`. Invocable as commands: `/product-management`, `/create-implementation-plan`, `/breakdown-plan-into-tasks`, `/orchestrator`, `/verify-implementation`, `/pr-review`, `/handle-ticket`, `/ticket-pipeline`.
- Subagents live in `.opencode/agent/*.md` (`analyst`, `express-coder`, `react-coder`, `committer`, `product-manager`). Spawn via the task tool with `subagent_type`.
- New documentation/analysis/reports go in `docs/ai_generated/` unless instructed otherwise.

## Secrets

Never commit or log secrets: Google OAuth client id/secret, `JWT_SECRET`. All via env vars (`.env`, gitignored). Never log tokens, JWTs, or full payloads.