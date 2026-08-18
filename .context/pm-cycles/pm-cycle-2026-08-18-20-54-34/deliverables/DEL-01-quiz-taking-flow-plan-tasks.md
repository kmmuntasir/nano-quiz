# Task Breakdown — DEL-01 (F-04 Quiz Taking Flow)

**Plan:** `DEL-01-quiz-taking-flow-plan.md`
**Generated:** 2026-08-18

## Parallelization Strategy

Three batches. All tasks in a batch are conflict-free (disjoint files). Batches merge in order 1 → 2 → 3; each merge leaves `npm test` green in both `backend/` and `frontend/`.

```
Batch 1 (foundations, all parallel)
T1 shuffle.ts ──┐
T2 db helpers ──┼──► Batch 2 (backend endpoints + docs)
T3 api types/services │      T5 GET /:id/question/:seq ─┐
T4 QuestionDisplay ───┘      T6 POST /:id/submit ──────┼──► Batch 3 (integration)
                             T7 API.md reconcile ──────┘   T8 QuizPlay full flow
                                                          T9 QuizPlay tests
```

- **Batch 1** (T1–T4): no dependencies; T1/T2 backend, T3/T4 frontend — two tracks can run all four concurrently.
- **Batch 2** (T5–T7): T5 and T6 both touch `routes/quizzes.ts` — sequence them (T5 then T6) within one track; T7 is docs-only, parallel.
- **Batch 3** (T8–T9): same file pair — run serially (T8 then T9, or one PR).

**Merge rules:** Batch 2 needs T1+T2 merged. Batch 3 needs T3+T4 merged plus the T5/T6 response contract. T8 removes the "Quiz started" placeholder text — the existing QuizPlay metadata test must be updated in the same change (combine T8/T9 or sequence immediately).

### Summary Table

| # | Batch | Target File | Dependencies | Can Parallel With |
|---|-------|-------------|--------------|-------------------|
| T1 | 1 | `backend/src/utils/shuffle.ts` + tests (new) | — | T2, T3, T4 |
| T2 | 1 | `backend/src/db/quizzes.ts` | — | T1, T3, T4 |
| T3 | 1 | `frontend/src/api/types.ts`, `frontend/src/api/client.ts` | — | T1, T2, T4 |
| T4 | 1 | `frontend/src/components/QuestionDisplay.tsx` + test (new) | T3 (Question type) | T1, T2 |
| T5 | 2 | `backend/src/routes/quizzes.ts` + `backend/tests/question.test.ts` | T1, T2 | T3*, T4*, T7 |
| T6 | 2 | `backend/src/routes/quizzes.ts` + `backend/tests/submit.test.ts` | T1, T2, T5 (same file) | T3*, T4*, T7 |
| T7 | 2 | `docs/api-docs/API.md` | T5, T6 (doc what shipped) | all |
| T8 | 3 | `frontend/src/pages/QuizPlay.tsx` | T3, T4, T5, T6 | T9 (serial — same pair) |
| T9 | 3 | `frontend/src/pages/QuizPlay.test.tsx` | T8 | — |

\* parallel in wall-clock but no file overlap.

### Developer Tracks

- **Track A (backend):** T1 → T2 → T5 → T6 → T7
- **Track B (frontend):** T3 → T4 → (wait for T5/T6 contract) → T8 → T9

---

## Batch 1

### T1 — Backend seeded shuffle module + unit tests

**Description**

Create `backend/src/utils/shuffle.ts` (plan §1) — pure module, no DB imports, no side effects:

- `hashSeedToUint32(seed: string): number` — FNV-1a (or similar) over the 10-hex start seed.
- `mulberry32(a: number): () => number` — seeded PRNG.
- `deriveQuestionOrder(seed: string, questionIds: string[], count: number): string[]` — Fisher-Yates over the full ID list (caller passes IDs ordered by the `seq` column), then take first `count`.

Determinism is the contract: imported by both question-fetch and submit (plan §3–§4), so export exactly these three names — signature drift breaks Batch 2.

Co-locate unit tests (match existing test layout). Cover: same seed → same order; different seeds → different orders (fixed ID fixtures); `count < list.length` → exact-length prefix; empty list; 1-element list; `count === list.length`.

**Acceptance Criteria**

- [ ] Exports `hashSeedToUint32`, `mulberry32`, `deriveQuestionOrder`; pure module.
- [ ] Deterministic for identical inputs; different seeds → different orders (test-proven).
- [ ] Prefix selection exact-length; empty/1-element lists don't throw.
- [ ] `npm test`, `npm run typecheck` pass in `backend/`.

**Dependencies:** None.

### T2 — DB helpers for questions and participations

**Description**

Extend the `quizzes` object in `backend/src/db/quizzes.ts` (plan §2). Match conventions: prepared statements at module load with named `@param` bindings (pattern at `db/quizzes.ts:84-97`), thin methods on the exported object (`:115-131`).

- `listQuestionIds(quizId): string[]` — `SELECT id FROM questions WHERE quiz_id = @quizId ORDER BY seq` (ORDER BY seq mandatory — stable shuffle input; index `idx_questions_quiz_id`).
- `getQuestionById(quizId, questionId): QuestionRow | undefined` — returns `id`, `prompt`, `options` (JSON text), `correct_opt`. Export the `QuestionRow` interface.
- `insertParticipation(userId, quizId, score, durationMs)` — INSERT into `participations` (`schema.ts:34-41`; composite PK enforces single participation; `completed_at` has a default — don't set it).
- `getParticipation(userId, quizId): { score: number; durationMs: number } | undefined` — map `duration_ms` → camelCase.

Helpers only; routes wire them in Batch 2.

**Acceptance Criteria**

- [ ] Four prepared-statement methods; named params only.
- [ ] `listQuestionIds` ordered by `seq`; `getQuestionById` scoped by quizId + id (no cross-quiz leak).
- [ ] `getParticipation` returns `undefined` / `{ score, durationMs }`.
- [ ] `npm run typecheck`, `npm test` pass in `backend/`.

**Dependencies:** None.

### T3 — Frontend types + API services

**Description**

Types in `frontend/src/api/types.ts` (exact backend shapes — key is `text`, not `prompt`):

```ts
export interface Question {
  seq: number;
  total: number;
  text: string;
  options: string[];
}

export interface SubmitResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  durationMs: number;
  participated: boolean;
}
```

Services in `frontend/src/api/client.ts`, matching the `startQuiz` one-liner style (`client.ts:100-103`):

```ts
export async function fetchQuestion(quizId: string, seq: number, seed: string): Promise<Question> {
  const { data } = await apiClient.get<Question>(`/quizzes/${quizId}/question/${seq}`, {
    params: { seed },
  });
  return data;
}

export async function submitQuiz(
  quizId: string,
  payload: { seed: string; answers: number[]; elapsedMs: number },
): Promise<SubmitResult> {
  const { data } = await apiClient.post<SubmitResult>(`/quizzes/${quizId}/submit`, payload);
  return data;
}
```

No UI changes in this task.

**Acceptance Criteria**

- [ ] `Question`, `SubmitResult` exported with exact fields.
- [ ] `fetchQuestion` (seed as query param), `submitQuiz` (JSON body) exported in service style.
- [ ] `npm run typecheck`, `npm run lint` pass in `frontend/`; existing tests unaffected.

**Dependencies:** None.

### T4 — QuestionDisplay component + tests

**Description**

Create `frontend/src/components/QuestionDisplay.tsx` (plan §8) — pure presentational:

- Props: `QuestionDisplayProps { question: Question; onAnswer(optionIndex: number): void; disabled?: boolean }` (import `Question` from T3's types — fixed contract).
- Renders progress `{question.seq} of {question.total}`, question `text`, one full-width button per option in order.
- Styling: Tailwind tokens only, mirror `StartQuizButton.tsx:66` button classes with dark-mode disabled variants. No inline `style`.
- **No previous/next/back controls** — advancing only via `onAnswer`.
- Functional component, default export, one per file.

Co-locate `QuestionDisplay.test.tsx` (Testing Library + user-event, role/text assertions): renders text + all options + "N of M"; option click fires `onAnswer` with correct index; `disabled` blocks interaction; no back-navigation affordances in the tree.

**Acceptance Criteria**

- [ ] Renders `{seq} of {total}`, text, ordered option buttons.
- [ ] Click → `onAnswer(index)`; `disabled` blocks.
- [ ] No back controls; Tailwind tokens only.
- [ ] Tests cover render, onAnswer, disabled, no-backtracking; `npm test`, `typecheck`, `lint` pass.

**Dependencies:** T3 (Question type import).

---

## Batch 2

### T5 — Question-fetch endpoint `GET /:id/question/:seq?seed=`

**Description**

Add to `backend/src/routes/quizzes.ts` (router already behind `requireAuth` at `:87`). Guard order mirrors `startQuiz` (`:45-84`):

1. `400 VALIDATION_ERROR` — missing/empty `seed`, or `seq` not a positive integer.
2. `404 NOT_FOUND` — unknown quiz (`:47-52` shape).
3. `deriveQuestionOrder(seed, quizzes.listQuestionIds(...), quiz.questionCount)`; `403 INVALID_SEED` on invalid seed/derivation failure.
4. `404` when `seq` outside `1..questionCount`.

**No active-window check** — in-flight attempts continue past `end_at` (do NOT copy `startQuiz`'s window check). No participation requirement (start writes no record).

200: `{ seq, total: questionCount, text: prompt, options: JSON.parse(options) }`. **Never `correct_opt`.**

Tests — new `backend/tests/question.test.ts`, conventions from `start.test.ts:1-115` (setup-env, `jwt.sign(..., 'test-jwt-secret')`, `insertQuiz` fixture with bank 4 / count 3, `iso()` offsets, clear-table `beforeEach`, `should_<behavior>_when_<condition>` naming):

- happy path per seq — full key set; exhaustive key check proves `correct_opt`/`prompt` absent.
- 400: missing seed; malformed seq (`abc`, `0`, `1.5`).
- 404 unknown quiz; seq bounds (`0`, `count+1`).
- 403 INVALID_SEED (non-hex seed).
- serves after `end_at` (in-flight continuation).
- determinism: same seed → same order across calls; different seed → different order.

**Acceptance Criteria**

- [ ] Guard order 400 → 404 → 403 → bounds with `{ error, message }` envelope.
- [ ] Response `{ seq, total, text, options }`; `correct_opt` never present.
- [ ] Works past `end_at`; deterministic per seed; bank > count serves exactly `count`, no duplicates.
- [ ] `npm test`, `npm run typecheck` pass in `backend/`.

**Dependencies:** T1, T2.

### T6 — Submit endpoint `POST /:id/submit`

**Description**

Add to `backend/src/routes/quizzes.ts`:

- Validation (`400 VALIDATION_ERROR`): seed present; `answers` integer array, length `=== questionCount`, each within its derived question's option bounds; `elapsedMs` non-negative number. Then `404 NOT_FOUND`, `403 INVALID_SEED`.
- **Idempotency pre-check**: `getParticipation` → if present, return `200` with stored score/duration + `participated: true` (API.md:134-136). No re-scoring.
- **Scoring in `db.transaction(...)`** (pattern `routes/auth.ts:36-50`): re-derive order (same T1 module + `listQuestionIds` — byte-identical to T5), fetch via `getQuestionById`, count `answers[i] === correct_opt`, `insertParticipation`. On composite-PK constraint error, re-read + return stored row (race). Roll back on any error.
- 200: `{ score, totalQuestions, correctCount, durationMs, participated: true }`. No answer key, no per-question correctness. `elapsedMs` stored as `duration_ms` for leaderboard only.

Tests — new `backend/tests/submit.test.ts` (same conventions):

- correct scoring against in-test-derived order (fixed seed via T1 module).
- participation row written (score + `duration_ms`).
- repeat submit → stored result, single row (idempotent).
- start → submit → start cycle → `409 ALREADY_PARTICIPATED`.
- 400s: missing seed; wrong answers length; non-integer; out-of-bounds; bad `elapsedMs`; 404 unknown quiz.
- exhaustive response key check — no answer key.

**Acceptance Criteria**

- [ ] All validation 400s with envelope.
- [ ] Transactional scoring with re-derived order identical to T5's.
- [ ] Repeat submit idempotent; one `participations` row after N submits.
- [ ] No answer key in any response; `elapsedMs` never gates correctness.
- [ ] `npm test`, `npm run typecheck` pass in `backend/`.

**Dependencies:** T1, T2, T5 (same route file — sequence after).

### T7 — API.md reconciliation

**Description**

Update `docs/api-docs/API.md`: question-fetch error row missing seed `403` → `400` (locked owner decision; doc follows code). Verify documented response shapes for question-fetch (`API.md:89-104`) and submit (`:134-136`) match T5/T6; fix drift in the same edit. Docs-only.

**Acceptance Criteria**

- [ ] Missing-seed row reads `400`; no other statuses altered.
- [ ] Documented shapes match implementations.

**Dependencies:** T5, T6.

---

## Batch 3

### T8 — Replace QuizPlay placeholder with full play flow

**Description**

Rewrite `frontend/src/pages/QuizPlay.tsx` (plan §9). Keep: session guard + `<Navigate to="/" replace />` (`:14-16`), `TopBar`, layout shell.

State: `seq` (starts 1, only increments), `answers: number[]`, `question | null`, `error`, `submitState: 'idle' | 'submitting' | 'failed'`, `result: SubmitResult | null`, `startedAt` in a `useRef(Date.now())` on mount.

- **Fetch**: mirror `QuizList.tsx:16-44` — `load` callback keyed on `seq` via `useEffect`; loading skeleton `aria-busy`; inline `<p role="alert">` + Retry (bumps `retryCount`). Uses `fetchQuestion(session.quizId, seq, session.seed)`.
- **Answer**: record `answers[seq-1]`; `seq < questionCount` → `setSeq(seq+1)`; else → submit.
- **Submit**: `submitQuiz(quizId, { seed, answers, elapsedMs: Date.now() - startedAt.current })`. Auto-retry bounded (e.g. 3, short backoff) only on `ApiError` `status === 0` (network, `client.ts:45-60`); on exhaustion `submitState: 'failed'` + manual Retry resubmitting the same payload. Disable `QuestionDisplay` while submitting. Retry bounds as SCREAMING_SNAKE constants.
- **Completion**: when `result !== null`, render "You scored {correctCount} of {totalQuestions}". No answer breakdown.
- Update the existing placeholder-metadata test assertion in the same change (or pair with T9).

**Acceptance Criteria**

- [ ] One question at a time via `QuestionDisplay`; loading/error/Retry states.
- [ ] Answer advances `seq`; nothing ever decrements it.
- [ ] Last answer → exactly one submit with `{ seed, answers, elapsedMs }`.
- [ ] Network failure auto-retries (bounded), then manual Retry; UI disabled while submitting.
- [ ] Completion screen "You scored X of Y"; no correct-answer info.
- [ ] Missing session still redirects; `npm test`, `typecheck`, `lint` pass.

**Dependencies:** T3, T4, T5, T6.

### T9 — QuizPlay test extension

**Description**

Extend `frontend/src/pages/QuizPlay.test.tsx` (plan §Testing). Reuse `renderAt` pattern (`:14-18` — `window.history.replaceState({ usr: { session }, key, idx }, ...)`, `seedSession()`, `renderApp()`). MSW handlers via `server.use(...)`: `GET /api/quizzes/:id/question/:seq` → `{ seq, total, text, options }`; `POST /api/quizzes/:id/submit` → `{ score, totalQuestions, correctCount, durationMs, participated }`. Small fixture (`questionCount: 2–3`). Naming `should_<behavior>_when_<condition>`.

Tests:
1. First question renders + "1 of N".
2. Answer advances to "2 of N"; previous question gone (no backtracking).
3. Last answer submits correct payload (captured body: seed matches, answers length = count, elapsedMs ≥ 0).
4. Completion screen "You scored X of Y".
5. Submit network failure → auto-retry then success; variant all-fail → manual Retry reaches completion.
6. Question-fetch error → `role="alert"` + Retry recovers.
7. Update existing metadata test to new UI; redirect test unchanged.

**Acceptance Criteria**

- [ ] All behaviors covered, one per test, MSW only, fixtures never contain `correct_opt`.
- [ ] `cd frontend && npm test`, `lint`, `typecheck` pass.

**Dependencies:** T8.
