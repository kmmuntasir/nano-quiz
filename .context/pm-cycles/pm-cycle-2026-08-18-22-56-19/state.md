# Product-Management Cycle — State

- **Project:** NanoQuiz
- **Started:** 2026-08-18
- **Phase:** done
- **Batch:** 0

## Source Issues
F-08 — Single participation lock
F-09 — Abandon & restart (no mid-way storage)
F-10 — Leaderboard view

Feature specs live in docs/features.md. Context from just-completed work (all merged to main): F-04 shipped the full play flow (seeded shuffle, question fetch, submit with server-side scoring, idempotent repeat submit, retry); F-05 shipped the per-question timer with `-1` timeout sentinel; F-06 hardened submit (sentinel accepted server-side, loader); F-07 shipped the Completion page and a minimal Leaderboard page at /quizzes/:id/leaderboard backed by the new GET /api/quizzes/:id/leaderboard endpoint (page/pageSize params, cap 100, but NO pagination UI yet — page 1 only). Overlap risk to scope carefully: much of F-08 (409 on second start, participated/userScore in quiz list) and F-09 (no mid-way storage by design) may already be satisfied — the deliverables must scope what REMAINS (likely mostly verification + test coverage + quiz-list score refresh after completing a quiz). F-10's remainder is pagination UI with working page navigation per its acceptance criteria. Produce end-to-end deliverables documents per the features.md acceptance criteria.

## Locked Decisions
- No clarification batch needed: all unknowns were codebase-resolvable; remaining scope is verification + leaderboard pagination UI.
- F-08 and F-09 deliverables scope the REMAINING work (verification + test hardening), not re-implementation of already-shipped behavior.
- F-10 remainder = pagination UI on the existing Leaderboard page, using the existing page/pageSize API; server already caps pageSize at 100, defaults 20. (assumed page size 20 default matches UI; override if a different size is wanted)

## Codebase Facts (from analyst)
- Start endpoint returns 409 ALREADY_PARTICIPATED (backend/src/routes/quizzes.ts startQuiz) and 409 INSUFFICIENT_QUESTIONS.
- GET /api/quizzes returns per-quiz `participated`, `userScore`, `canStart` via LEFT JOIN (no N+1) — backend/src/db/queries listForUser.
- Submit writes participations row inside transaction; idempotent (pre-check + UNIQUE-violation re-read).
- No mid-way storage by construction: start only mints a seed (randomBytes hex); nothing persisted until submit.
- Frontend QuizList refetches on mount, visibilitychange, and after a failed start; StartQuizButton disables with "You scored X/N" when participated.
- Leaderboard endpoint (backend/src/routes/leaderboard.ts): GET /:id/leaderboard?page=&pageSize= → { quizId, page, pageSize, total, entries:[{rank,name,score,durationMs}] }; ordering score DESC, duration_ms ASC; defaults 1/20, max 100.
- Leaderboard page UI renders page 1 only; api fetchLeaderboard sends no page/pageSize params — pagination UI is the main gap.
- No docs/deliverables.md or docs/deliverables/ exemplars exist; use templates from the skill.

## Question History
(none)

## Deliverables (when phase=done)
- DEL-01 — Single participation lock: verification & test hardening — depends on: —
- DEL-02 — Abandon & restart: verification & test hardening — depends on: —
- DEL-03 — Leaderboard pagination UI — depends on: —
- Output: deliverables.md + deliverables/DEL-01..03
