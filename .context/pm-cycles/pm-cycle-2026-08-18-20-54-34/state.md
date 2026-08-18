# Product-Management Cycle — State

- **Project:** NanoQuiz
- **Started:** 2026-08-18
- **Phase:** done
- **Batch:** 1

## Source Issues
F-04 — Quiz taking flow (one question at a time). Feature spec lives in docs/features.md (NanoQuiz repo at /home/munna/speedo/localhost/nano-quiz). Context: F-03 (start gating) is Done — POST /api/quizzes/:id/start exists with seed generation, QuizPlay page is currently a placeholder, GET /api/quizzes/:id/question/:seq?seed= does not exist yet. Produce the end-to-end deliverables document for F-04 per its acceptance criteria in docs/features.md (seed-based shuffle, one question per screen, progress indicator, no backtracking, no correct-answer leakage).

## Locked Decisions
- F-04 scope excludes the per-question timer/auto-advance (F-05) and the leaderboard/completion screen — those are separate features.
- Shuffle implementation: seeded PRNG (e.g. mulberry32) + Fisher-Yates over the quiz's question IDs, derived from the `seed` returned by start (assumed — matches backend rules).
- Server serves questions by `seq`; no server-side enforcement of client visit order beyond validation (seq bounds, seed validity) (confirmed by owner, batch 01 Q2).
- Owner decisions (batch 01): F-04 includes `POST /api/quizzes/:id/submit` with server-side scoring + a minimal "You scored X of Y" completion screen (option A); missing/malformed seed or seq → `400`; unknown quiz → `404`; invalid seed → `403 INVALID_SEED`.

## Codebase Facts (from analyst)
- F-04 spec (features.md:112-127): start returns seed; server derives shuffled order; one question/screen, options, progress "3 of 10"; select answer to advance; no backtracking; order randomized per participant; no response ever contains correct answer. API: POST start, GET question/:seq?seed. Depends on F-03 (Done).
- Start endpoint exists (backend/src/routes/quizzes.ts:45-84): 404/403 QUIZ_NOT_ACTIVE/409 ALREADY_PARTICIPATED/409 INSUFFICIENT_QUESTIONS; returns `{ seed, quizId, questionCount, timeLimitSeconds }`; seed = 10 hex chars, not persisted.
- Question fetch endpoint does NOT exist; no shuffle/PRNG module exists in backend/src.
- questions table (backend/src/db/schema.ts:24-32): `id, quiz_id, seq, prompt, options (JSON), correct_opt`, UNIQUE(quiz_id, seq). participations table exists.
- Submit endpoint NOT implemented yet.
- Frontend: QuizPlay is a placeholder reading `location.state.session` (QuizSession) with redirect to `/` if absent; no QuestionDisplay/TimerCountdown/useQuizTimer; api/client.ts has fetchQuizzes + startQuiz only; route `/quizzes/:id/play` exists.
- API.md contracts: question fetch 200 `{ seq, total, text, options: string[] }`, never correct_opt. Submit `{ seed, answers: number[], elapsedMs }` → `{ score, totalQuestions, correctCount, durationMs, participated }`.
- No docs/deliverables.md exemplar exists — use canonical template shape.

## Question History
- batch 01 — end-of-quiz behavior in F-04, seq/seed validation policy — answered 2026-08-18 (A: submit+minimal completion; A: serve any in-bounds seq; 400 for missing seed)

## Deliverables (phase=done)
- DEL-01 — Quiz taking flow: one question at a time (shuffle, question fetch, submit + scoring, play UI) — depends on: F-03 (Done)
- Index: deliverables.md; detail: deliverables/DEL-01-quiz-taking-flow.md
