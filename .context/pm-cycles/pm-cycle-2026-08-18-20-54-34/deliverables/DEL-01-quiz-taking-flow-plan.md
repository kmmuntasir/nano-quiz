# Implementation Plan — DEL-01 (F-04)

**Ticket:** `.context/pm-cycles/pm-cycle-2026-08-18-20-54-34/deliverables/DEL-01-quiz-taking-flow.md`
**Type:** Feature
**Title:** Quiz taking flow — one question at a time (seeded shuffle, question fetch, submit + scoring, QuizPlay UI)
**Generated:** 2026-08-18

---

## Summary

Deliver the core play flow. Backend: a pure seeded-shuffle module (mulberry32 + Fisher-Yates over the quiz's question IDs), a question-fetch endpoint serving one question per `seq` without `correct_opt`, and a submit endpoint that scores server-side in a transaction and writes the single `participations` row (idempotent on repeat). Frontend: replace the `QuizPlay` placeholder with a one-question-at-a-time flow — progress indicator, answer-to-advance, no backtracking, submit with auto+manual retry, minimal completion screen ("You scored X of Y").

Locked owner decisions: missing seed → `400` (overrides API.md's 403 note — API.md should be reconciled); server serves any in-bounds `seq` (no order tracking; no-backtracking is client-enforced); submit + minimal completion screen included in F-04.

## Affected Components

| Layer | File | Why |
|-------|------|-----|
| Util | `backend/src/utils/shuffle.ts` (new) | Seeded PRNG + Fisher-Yates; pure, shared by fetch + submit |
| DB | `backend/src/db/quizzes.ts` | Add `listQuestionIds`, `getQuestionById`, `insertParticipation`, `getParticipation` helpers |
| Route | `backend/src/routes/quizzes.ts` | Add `GET /:id/question/:seq`, `POST /:id/submit` |
| Types | `frontend/src/api/types.ts` | `Question`, `SubmitResult` types |
| API | `frontend/src/api/client.ts` | `fetchQuestion`, `submitQuiz` services |
| Component | `frontend/src/components/QuestionDisplay.tsx` (new) | One question, options, "N of M" progress |
| Page | `frontend/src/pages/QuizPlay.tsx` | Replace placeholder with play flow + completion screen |
| Tests | `backend/tests/question.test.ts`, `backend/tests/submit.test.ts`, `frontend/src/components/QuestionDisplay.test.tsx`, `frontend/src/pages/QuizPlay.test.tsx` | Per conventions |

## Proposed Implementation

### Backend Changes

**1. Seeded shuffle module** — `backend/src/utils/shuffle.ts`
- Export `hashSeedToUint32(seed: string): number` (FNV-1a or similar over the 10-hex seed), `mulberry32(a: number)` PRNG, and `deriveQuestionOrder(seed: string, questionIds: string[], count: number): string[]`.
- Fisher-Yates shuffle of the full ordered ID list (ordered by `seq` column for stability), then take the first `count` (= `questionCount`). Deterministic: same inputs → same order.
- Pure function, no DB, no state. Flagged assumption in the ticket (mulberry32 + Fisher-Yates) — implement as specified.

**2. DB helpers** — `backend/src/db/quizzes.ts` (extend the `quizzes` object, prepared at module load, matching named-param style at `db/quizzes.ts:27-131`)
- `listQuestionIds(quizId): string[]` — `SELECT id FROM questions WHERE quiz_id = ? ORDER BY seq` (index `idx_questions_quiz_id`, schema.ts:43).
- `getQuestionById(quizId, questionId): QuestionRow | undefined` — returns `prompt`, `options` (JSON text), `correct_opt`.
- `insertParticipation(userId, quizId, score, durationMs)` — INSERT into `participations` (schema.ts:34-41; composite PK enforces single participation).
- `getParticipation(userId, quizId): { score, durationMs } | undefined` — for idempotent repeat submit.

**3. Question-fetch endpoint** — `routes/quizzes.ts`, `GET /:id/question/:seq`
- Guard order (mirrors `startQuiz` at quizzes.ts:45-84):
  1. `400 VALIDATION_ERROR` — missing `seed` query param or non-integer/out-of-format seq.
  2. `404 NOT_FOUND` — unknown quiz.
  3. Derive order via shuffle module. `403 INVALID_SEED` when the seed fails to derive a valid set (per ticket).
  4. `400`/`404` (per API.md: bad seq) when `seq` outside `1..questionCount`.
- **No active-window check** — in-flight attempts continue past `end_at` (backend rules; quiz already started).
- 200: `{ seq, total: questionCount, text: <prompt>, options: <JSON.parse(options)> }` — key is `text` (API.md:89-104), not the DB's `prompt`. **Never include `correct_opt`** or any correctness info.
- Participation must NOT be required to fetch (start leaves no record; abandoned restart needs fetch to work).

**4. Submit endpoint** — `routes/quizzes.ts`, `POST /:id/submit`
- Validation (`400 VALIDATION_ERROR`): `seed` present; `answers` array of integers, length `=== questionCount`, each within `0..options.length-1` of its question; `elapsedMs` non-negative number.
- `404 NOT_FOUND` unknown quiz; `403 INVALID_SEED` bad seed.
- **Idempotency**: check `getParticipation` first — if present, return the stored result (`200` with stored score/duration and `participated: true`) per API.md:134-136. (Pre-check avoids relying on PK-conflict errors; still wrap the write in a transaction.)
- Scoring inside `db.transaction(...)`: re-derive the shuffled order from the seed (same module), count `answers[i] === correct_opt` per derived question, insert the `participations` row with score + `elapsedMs` as `duration_ms`.
- 200: `{ score, totalQuestions, correctCount, durationMs, participated: true }`. No answer key, no per-question correctness.
- `elapsedMs` stored for leaderboard only — never gates correctness.

**5. API doc reconciliation** — `docs/api-docs/API.md`: update the question-fetch error row for missing seed from 403 → 400 to match the locked decision.

### Frontend Changes

**6. Types** — `frontend/src/api/types.ts`
- `Question { seq: number; total: number; text: string; options: string[] }`
- `SubmitResult { score: number; totalQuestions: number; correctCount: number; durationMs: number; participated: boolean }`

**7. API services** — `frontend/src/api/client.ts` (one-liner style like `startQuiz` at client.ts:100-103)
- `fetchQuestion(quizId: string, seq: number, seed: string): Promise<Question>` — `GET /quizzes/${quizId}/question/${seq}?seed=${seed}`.
- `submitQuiz(quizId: string, payload: { seed: string; answers: number[]; elapsedMs: number }): Promise<SubmitResult>` — `POST /quizzes/${quizId}/submit`.

**8. QuestionDisplay component** — `frontend/src/components/QuestionDisplay.tsx`
- Props: `question: Question`, `onAnswer(optionIndex: number): void`, optional `disabled`.
- Renders progress `{seq} of {total}`, question `text`, option buttons (full-width, QuizCard/StartQuizButton button styling: `rounded-md bg-brand-500 ... hover:bg-brand-600`).
- No previous/next controls — advancing only via answering.

**9. QuizPlay page** — replace `frontend/src/pages/QuizPlay.tsx` placeholder
- Keep existing `location.state.session` guard + `<Navigate to="/" replace />` (QuizPlay.tsx:14-16) and layout shell/TopBar.
- State: `seq` (starts 1), `answers: number[]`, `question | null`, `error`, `submitState: idle | submitting | failed`, `result: SubmitResult | null`. Record `startedAt = Date.now()` (ref) on mount for `elapsedMs`.
- Fetch pattern mirrors QuizList (QuizList.tsx:16-44): `load` on `seq` change, loading skeleton with `aria-busy`, inline error `<p role="alert">` + Retry button.
- On answer: record `answers[seq-1]`, if `seq < questionCount` → `setSeq(seq+1)`; else → submit.
- Submit: `submitQuiz(quizId, { seed, answers, elapsedMs: Date.now() - startedAt })`. Auto-retry on network failure (`ApiError` with `status === 0`, client.ts:45-60) — bounded retries (e.g. 3, short backoff); on exhaustion show error + manual Retry button that resubmits the same payload. Disable interaction while submitting.
- Completion screen (inline section): "You scored {score} of {totalQuestions}" from `SubmitResult`. No answer breakdown.
- No backtracking: `seq` only increments; no UI or state path decrements it.

## Edge Cases & Risks

- **Answer leakage** — `correct_opt` must not appear in any response or log; assert in tests via full-key response checks.
- **Bank > questionCount** — fixtures have a 4-question bank with `questionCount` 3; shuffle must select exactly `questionCount` after full shuffle, deterministically on both fetch and submit (same derived order or scoring is wrong).
- **Idempotent submit race** — two concurrent submits for the same user+quiz: composite PK makes the second INSERT fail; pre-check inside the transaction or catch the constraint error and return the stored row.
- **Sequential-order question IDs** — `listQuestionIds` must ORDER BY `seq` so the shuffle input is stable across calls.
- **JSON options parse failure** — corrupted row would crash JSON.parse; questions are admin-written, low risk; a try/catch returning 500 (envelope, no internals) is acceptable.
- **Abandon mid-quiz** — nothing persisted until submit lands (F-09 semantics already hold; no route writes before submit).
- **elapsedMs client-supplied** — accepted as-is for leaderboard duration only; never trusted for gating (already locked).

## Testing

- **Backend unit (shuffle)**: same seed → same order; different seeds → different orders (with fixed ID lists); count < bank length selects prefix; empty/1-element lists.
- **HTTP tests — question fetch** (`backend/tests/question.test.ts`, conventions from `start.test.ts:30-115`): happy path per seq (full key set, `correct_opt` absent), missing seed → 400, malformed seq → 400, out-of-range seq → 404/400 per API.md, unknown quiz → 404, works after `end_at` (in-flight continues), deterministic order across two fetches with same seed, different order for different seed.
- **HTTP tests — submit** (`backend/tests/submit.test.ts`): correct scoring (answers re-ordered per shuffle), participation row written (score/duration), repeat submit → stored result (idempotent, no double-score), submit after participation via fresh start → 409 path per API.md, validation 400s (answers length, non-integer, out-of-bounds, negative elapsedMs, missing seed), no `correct_opt`/per-question correctness in response.
- **Frontend — QuestionDisplay.test.tsx**: renders text/options/progress, answer click fires `onAnswer` with index, no back navigation affordances.
- **Frontend — QuizPlay.test.tsx** (extend; MSW handlers for question + submit): renders first question with "1 of N", advances on answer, last answer triggers submit with correct payload `{ seed, answers, elapsedMs }`, network failure → auto-retry then manual retry button, completion screen shows score, missing session state → redirect (existing test).
- **Manual verification**: start the seeded `quiz-live-gk`, play through 3 questions, confirm score screen; refresh mid-quiz → redirected to list, quiz restartable (no participation record).

## Acceptance Criteria

- [ ] `GET /api/quizzes/:id/question/:seq?seed=` serves each question per API.md shape; `correct_opt` never in any response or log.
- [ ] Same seed → same order; different seeds → different orders (tests prove both).
- [ ] Missing seed / malformed seq or answers → `400` + envelope; unknown quiz → `404`; invalid seed → `403 INVALID_SEED`.
- [ ] UI shows one question at a time with "N of M" progress and no way back.
- [ ] Last answer submits `{ seed, answers, elapsedMs }`; completion screen shows "You scored X of Y".
- [ ] Repeat submit returns the stored result; repeat start after completion → `409 ALREADY_PARTICIPATED`.
- [ ] Submit network failure auto-retries, then offers manual retry; no participation recorded until a submit succeeds.
- [ ] All backend + frontend tests pass (`npm test` in both).

## Open Questions

- API.md says 403 for missing seed; ticket locks 400. Plan implements 400 and updates API.md — confirm if API.md should instead stay authoritative.

## Out of Scope

- Per-question timer / auto-advance (F-05), leaderboard UI, rich completion screen, server-side visit-order enforcement, `useQuizTimer`.
