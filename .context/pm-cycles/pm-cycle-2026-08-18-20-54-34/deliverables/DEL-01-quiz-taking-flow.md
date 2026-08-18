# DEL-01 · Feature · Quiz Taking Flow — One Question at a Time

> **Source:** [`deliverables.md`](../deliverables.md) (DEL-01)
> **Original issue(s):** F-04 — Quiz taking flow (one question at a time), per docs/features.md acceptance criteria.

## Problem

A contestant can start a quiz (F-03 returns `{ seed, quizId, questionCount, timeLimitSeconds }`), but there is nothing to play: `QuizPlay` is a placeholder, the question-fetch endpoint `GET /api/quizzes/:id/question/:seq?seed=` does not exist, and neither does the submit/scoring endpoint. The core product promise — one randomized question per screen, progress indicator, no backtracking, no answer leakage — is unimplemented.

## Solution (end-to-end)

### Backend

- **Shuffle module** (`backend/src/utils/shuffle.ts` or equivalent): seeded PRNG (mulberry32) + Fisher-Yates over the quiz's question IDs. Given a `seed` and the quiz's ordered question IDs, derive the per-contestant question order deterministically. Pure function — no state, nothing persisted.
- **`GET /api/quizzes/:id/question/:seq?seed=`** (JWT-protected, added to `routes/quizzes.ts`):
  - `400` missing/malformed `seed` (and invalid `seq` param) — per locked decision, `400` for missing seed.
  - `404` unknown quiz.
  - `403 QUIZ_NOT_ACTIVE` only if needed for consistency with start (in-flight attempts continue past `end_at` per rules — do NOT reject in-flight fetches on window).
  - `403 INVALID_SEED` when the seed fails to derive a valid question set for that quiz.
  - Serve any `seq` within `1..questionCount` after seed validation (locked decision: no server-side order tracking; no-backtracking is client-enforced; skipping yields no advantage since `correct_opt` is never exposed).
  - `200` response: `{ seq, total, text, options: string[] }` — exactly the API.md contract. **`correct_opt` is never included**, nor any per-question correctness.
- **`POST /api/quizzes/:id/submit`** (JWT-protected):
  - Body: `{ seed, answers: number[], elapsedMs }`. Validate: seed present/valid, `answers` is an array of integers within option bounds and length `=== questionCount`, `elapsedMs` a non-negative number.
  - Server-side scoring in a transaction: re-derive the shuffled order from the seed, score `answers` against `correct_opt`, write the `participations` row (single participation), persist score/duration.
  - `409 ALREADY_PARTICIPATED` if a participation exists for user+quiz.
  - `200`: `{ score, totalQuestions, correctCount, durationMs, participated }` per API.md. Score results only — no answer key, no per-question correctness in the response.
- `elapsedMs` is stored for leaderboard duration only, never for correctness gating.

### Frontend

- **QuizPlay page** (replace placeholder): reads the `QuizSession` from `location.state` (existing behavior: redirect to `/` if absent). Holds local state: current `seq`, in-memory `answers[]` array.
- **QuestionDisplay component**: renders one question at a time — prompt, option buttons, progress indicator "3 of 10" (`seq of total`).
- **Answer → advance**: selecting an option records `answers[seq-1]` and fetches `seq+1`. No back navigation — previous/next controls absent; state never allows revisiting.
- **API services** in `api/client.ts` or a quiz service module: `fetchQuestion(quizId, seq, seed): Promise<Question>` and `submitQuiz(quizId, { seed, answers, elapsedMs })` — typed to match the backend contract exactly.
- **End of quiz**: on the last answer, call submit (option A, locked). **Submit must have retry**: auto-retry on network failure + manual retry button (nothing is stored server-side until it lands; an un-retryable failure would lose the attempt).
- **Minimal completion screen** (inline in QuizPlay or a small Completion view): "You scored X of Y" from the submit response. Full completion/leaderboard UX is out of scope (later feature).
- Loading and error states for question fetch and submit (reuse `ErrorMessage`).

### Out of scope

- Per-question timer / auto-advance (F-05).
- Leaderboard UI and completion-screen richness.
- Server-side visit-order enforcement.

## Acceptance criteria

- Starting a quiz (existing F-03 endpoint) then fetching `seq=1..questionCount` with the returned seed serves each question exactly per API.md shape; `correct_opt` never appears in any response or log.
- The same seed always yields the same question order server-side; different seeds yield different orders (seeded PRNG + Fisher-Yates).
- Two participants on the same quiz see different question orders.
- Missing seed or malformed seq/answers → `400` + error envelope; unknown quiz → `404`; invalid seed → `403 INVALID_SEED`.
- The UI shows one question at a time with a "N of M" progress indicator and no way to go back.
- Selecting an answer advances immediately; after the last answer the client submits `{ seed, answers, elapsedMs }` and shows "You scored X of Y".
- A second submit (or second start) for the same user+quiz → `409 ALREADY_PARTICIPATED`.
- Network failure on submit triggers auto-retry and offers a manual retry button; no participation is recorded until a submit succeeds.
- Backend tests (supertest): happy path per-seq fetch, seed validation, bounds, answer-leakage assertion (response JSON has no `correct_opt`), submit scoring correctness (answers re-ordered per shuffle), 409 repeat participation, 400 validation paths.
- Frontend tests (Testing Library + MSW): renders question + progress, advance on answer, no-back navigation, submit call payload, retry on failure, completion screen.

## Dependencies

- F-03 start endpoint (Done — exists at `backend/src/routes/quizzes.ts:45-84`). No DEL dependencies; this is the foundational play-flow deliverable.
