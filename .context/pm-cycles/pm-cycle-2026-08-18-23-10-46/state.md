# Product-Management Cycle — State

- **Project:** NanoQuiz
- **Started:** 2026-08-18
- **Phase:** done
- **Batch:** 0

## Source Issues
A-01 — Admin identity & gated admin UI
A-02 — Create a quiz
A-03 — Admin quiz list
A-04 — Question bank: add question
A-05 — Publish a playable quiz (questionCount vs bank)
A-06 — Edit a quiz
A-07 — Edit / delete a question
A-08 — Delete a quiz (cascade)
A-09 — Admin leaderboard (read-only)
All nine admin features; specs in docs/features.md. All contestant features F-01..F-10 done/merged.

## Locked Decisions
- Grouping: 4 end-to-end deliverables (admin foundation; quiz CRUD; question bank + publish gating; admin leaderboard), not 1:1 with feature IDs.
- Admin API contract follows docs/api-docs/API.md /api/admin/* exactly — no new shapes invented.
- require-admin middleware is the security boundary; frontend hiding is cosmetic.
- correct_opt returned by admin question endpoints only; never on contestant endpoints.
- Edit-block-on-attempts (409) applies to quiz edits and question edit/delete; delete quiz always allowed (cascade).
- Admin UI: single Admin page area with lazy-loaded routes, gated by requireAdmin ProtectedRoute; admin link in nav only when isAdmin (assumed — override if wrong).
- No clarification batch needed — specs fully answer all product questions (assumed — override if wrong).

## Codebase Facts (from analyst)
- No `require-admin.ts`; `middleware/auth.ts` sets `req.isAdmin` (line 69). No `routes/admin/`.
- Participant flow implemented: quizzes.ts (`GET /`, start, question/:seq, submit), leaderboard.ts (`GET /:id/leaderboard`, paginated, cap 100).
- Schema (db/schema.ts): quizzes(title, description, question_count, time_limit_seconds, start_at, end_at); questions(quiz_id CASCADE, seq, prompt, options, correct_opt, UNIQUE(quiz_id,seq)); participations PK(user_id,quiz_id).
- Frontend: pages Login/QuizList/QuizPlay/Completion/Leaderboard; ProtectedRoute checks token only — no requireAdmin; no Admin UI/routes/links.
- No docs/deliverables.md or docs/deliverables/ exemplars — use canonical templates.

## Deliverables
- DEL-01 — Admin auth foundation & gated admin UI — depends on: —
- DEL-02 — Admin quiz CRUD (create, list, edit, delete cascade) — depends on: DEL-01
- DEL-03 — Question bank management & publish gating — depends on: DEL-02
- DEL-04 — Admin leaderboard (read-only) — depends on: DEL-01
- Index: deliverables.md; details: deliverables/
