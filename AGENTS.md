# AGENTS.md

Guidance for opencode when working in this repository. The canonical spec lives in `docs/PRD.md`; Claude Code instructions live in `CLAUDE.md`. Project-specific rules live in `.claude/rules/*.md` — read them as needed for backend/frontend/security/style/testing detail.

## Project

NanoQuiz (OpenQuiz) — a plug-n-play quiz platform. Organizations fork it, drop in JSON question files, configure env vars, and deploy a secure, timed 10-question assessment with single-attempt enforcement and leaderboard.

**Stack:**
- Backend: Node.js 24 + Express.js 5 + TypeScript + `pg` (PostgreSQL, NO ORM) → Render
- Frontend: React 19 + Vite + TypeScript + Tailwind CSS → Vercel
- Auth: Google OAuth 2.0 (`@react-oauth/google` client, `google-auth-library` server) + app JWT (`jsonwebtoken`, 2h expiry)
- Testing: Vitest (backend: supertest; frontend: Testing Library + MSW)

## Commands

```bash
# Backend (backend/)
npm run dev          # tsx watch, port 3000
npm run build        # tsc
npm start            # node dist/index.js
npm run seed         # idempotent question seeding
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

1. **No correct answers exposed** — `correct_opt` is NEVER sent to the frontend. Scoring is server-side, triggered on Q10 answer.
2. **Server-side timing** — all business timestamps use PostgreSQL `NOW()`. Client timestamps ignored.
3. **Single attempt** — enforced at app level (`started_at` check) and DB level (trigger `prevent_multiple_quiz_attempts`).
4. **Sequential access** — question fetch rejects any sequence other than the user's current first unanswered (403).
5. **No backtracking** — users cannot revisit answered questions.
6. **Event deadline** — `EVENT_DEADLINE_ISO` enforced via deadline middleware (exempt: status, leaderboard).
7. **Per-question time limit** — `QUESTION_TIME_LIMIT_SECONDS` (default 10s) enforced via `viewed_at`.
8. **Backend layering** — route → middleware → db. `db/index.ts` owns the `pg.Pool` + `query<T>()` + `getClient()`. Parameterized queries only.

## API overview

`POST /api/auth/google`, `POST /api/auth/onboard`, `GET /api/quiz/status`, `POST /api/quiz/start`, `GET /api/quiz/question/:seq`, `POST /api/quiz/answer`, `POST /api/quiz/timeout`, `GET /api/leaderboard`, `GET /health`. Full spec: `docs/api-docs/API.md`. All `/api/*` (except auth) require Bearer JWT.

## Skills & agents

- Skills live in `.opencode/skills/*/SKILL.md`. Invocable as commands: `/product-management`, `/create-implementation-plan`, `/breakdown-plan-into-tasks`, `/orchestrator`, `/verify-implementation`, `/pr-review`, `/handle-ticket`, `/ticket-pipeline`.
- Subagents live in `.opencode/agent/*.md` (`analyst`, `express-coder`, `react-coder`, `committer`, `product-manager`). Spawn via the task tool with `subagent_type`.
- New documentation/analysis/reports go in `docs/ai_generated/` unless instructed otherwise.

## Secrets

Never commit or log secrets: Google OAuth client id/secret, `JWT_SECRET`, `SUPABASE_DB_URL`. All via env vars (`.env`, gitignored). Never log tokens, JWTs, or full payloads.