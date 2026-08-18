# Task Breakdown — DEL-01/02/03 (F-05 timer, F-06 submit hardening, F-07 result screen)

**Plan:** `DEL-01-03-plan.md`
**Generated:** 2026-08-18

## Parallelization Strategy

Batch 1 (T1–T4): parallel, disjoint files. Batch 2: T5 ∥ T6, then T7 → T8 strictly serial (both edit `App.tsx`).

```
Batch 1:  T1 (-1 sentinel)   T2 (leaderboard API)   T3 (useQuizTimer)   T4 (TimerCountdown + formatDuration)
             │                    │                      │                    │
Batch 2:  T5 (API.md docs ◄─ T1+T2)   T6 (QuizPlay wiring ◄─ T1+T3+T4)
                                            │
                                       T7 (Completion page ◄─ T6)  ──►  T8 (Leaderboard page ◄─ T2+T4+T7)
```

**Merge rules:** every merge leaves both suites green. T6 updates QuizPlay tests in the same change as the behavior change. T7 removes the inline score and migrates its assertions to `Completion.test.tsx` in the same change. T7 before T8 (App.tsx conflict).

| # | Batch | Target File(s) | Dependencies | Can Parallel With |
|---|-------|----------------|--------------|-------------------|
| T1 | 1 | `backend/src/routes/quizzes.ts`, `backend/tests/submit.test.ts` | — | T2, T3, T4 |
| T2 | 1 | `backend/src/routes/leaderboard.ts` (new), `backend/src/db/quizzes.ts`, `backend/src/index.ts`, `backend/tests/leaderboard.test.ts` | — | T1, T3, T4 |
| T3 | 1 | `frontend/src/hooks/useQuizTimer.ts` (+ test) | — | T1, T2, T4 |
| T4 | 1 | `frontend/src/components/TimerCountdown.tsx`, `frontend/src/utils/formatDuration.ts` (+ tests) | — | T1, T2, T3 |
| T5 | 2 | `docs/api-docs/API.md` | T1, T2 | T6, T7, T8 |
| T6 | 2 | `frontend/src/pages/QuizPlay.tsx`, `QuizPlay.test.tsx` | T1, T3, T4 | T5 |
| T7 | 2 | `frontend/src/pages/Completion.tsx` (new), `frontend/src/App.tsx`, `Completion.test.tsx`, `QuizPlay.tsx` nav | T6 | T5; not T8 |
| T8 | 2 | `frontend/src/pages/Leaderboard.tsx` (new), `api/types.ts`, `api/client.ts`, `App.tsx`, `Leaderboard.test.tsx` | T2, T4, T7 | T5 |

**Tracks:** Backend: T1 → T2 → T5. Frontend: T3 → T4 → T6 → T7 → T8. Sync points: T1 before T6; T2 before T8; T7 before T8.

---

## Batch 1

### T1 — Backend: accept `-1` timeout sentinel in submit validation

**Description**

`backend/src/routes/quizzes.ts` — change the per-answer predicate at `:256` from `a >= 0 && a < optionCount` to `a === -1 || (a >= 0 && a < optionCount)`. Per-question bounds derivation (`:246-252`) untouched. Scoring needs no change — `scoreAndStore` compares `answers[i] === correctOpt` (`:191`) and `correct_opt >= 0`, so `-1` never matches; `-2`/fractions still 400.

Tests — extend `backend/tests/submit.test.ts` (conventions: JWT `jwt.sign({ userId, isAdmin: false }, 'test-jwt-secret')`, module-load `db.prepare` fixtures, `beforeEach` clears, `should_x_when_y` naming):
- all-`-1` answers → 200, `score === 0`, participation row written.
- `-2` → 400 `VALIDATION_ERROR`.
- mixed `-1` + correct → positional scoring intact.
- existing out-of-bounds test (`:208-217`, value `9`) unchanged, still green.

**Acceptance Criteria**

- [ ] `-1` accepted, scored incorrect; `-2`/fractions/out-of-range still 400.
- [ ] Mixed positional scoring; response key set unchanged; no `correct_opt` leakage.
- [ ] `npm test`, `typecheck`, `lint` pass in `backend/`.

**Dependencies:** None.

### T2 — Backend: leaderboard endpoint `GET /api/quizzes/:id/leaderboard`

**Description**

Per API.md:140-156 (spec'd, never built — only auth/quizzes/health mounted at `backend/src/index.ts:46-48`).

- New `backend/src/routes/leaderboard.ts` — `leaderboardRouter` behind `requireAuth`, `GET /:id/leaderboard`. Conventions of `routes/quizzes.ts`: validation → existence guard order, `{ error, message }` envelope. `400 VALIDATION_ERROR` malformed `page`/`pageSize` (positive integers, defaults 1/20, cap pageSize 100 as a constant); `404 NOT_FOUND` unknown quiz.
- DB helper in `backend/src/db/quizzes.ts` — module-load prepared statements, named params:
  - entries: `SELECT users.name, participations.score, participations.duration_ms FROM participations JOIN users ON users.id = participations.user_id WHERE quiz_id = @quizId ORDER BY score DESC, duration_ms ASC LIMIT @limit OFFSET @offset`
  - total: `SELECT COUNT(*) ... WHERE quiz_id = @quizId`
- Mount in `backend/src/index.ts`: `app.use('/api/quizzes', leaderboardRouter)`.
- Response: `{ quizId, page, pageSize, total, entries: [{ rank, name, score, durationMs }] }`, `rank = offset + index + 1`. Display names only — no emails, no answer data.

Tests — new `backend/tests/leaderboard.test.ts` (submit.test.ts conventions): ordering (score DESC, duration ASC tie-break), rank across pages, empty (`entries: []`, `total: 0`), 404, 400 malformed page/pageSize (non-integer, zero, negative, > cap), 401, exact response key set.

**Acceptance Criteria**

- [ ] 200 with exact response shape; ordering + sequential ranks correct.
- [ ] Defaults 1/20, cap 100, 400 on malformed; 404 unknown quiz; 401 no token.
- [ ] Prepared statements only; no emails/answer data in response.
- [ ] `npm test`, `typecheck`, `lint` pass in `backend/`.

**Dependencies:** None.

### T3 — Frontend: `useQuizTimer` countdown hook

**Description**

New `frontend/src/hooks/useQuizTimer.ts` + colocated `useQuizTimer.test.ts`.

- API: `useQuizTimer({ seconds, active, resetKey?, onTimeout })` → `{ remaining }` (whole seconds). Deadline-based tick (`Date.now()` deadline, ~250ms interval, `TICK_INTERVAL_MS` constant).
- `active: false` → paused/inert: no ticking, `onTimeout` never fires.
- `onTimeout` fires exactly once per activation (fired-flag guard — answer and timeout can land on the same tick). Effect cleanup cancels on unmount/reset.
- Reset on `resetKey` change. StrictMode-safe symmetric setup/teardown.
- Conventions: explicit interfaces, no `any`, SCREAMING_SNAKE constants.

Tests (explicit `vi.useFakeTimers()` + teardown): countdown decrements; `onTimeout` fires once at expiry; no fire when `active` flips false before expiry; resets on `resetKey`; no fire after unmount.

**Acceptance Criteria**

- [ ] Hook exported with typed interfaces; single-fire semantics; deactivate/reset/unmount clean.
- [ ] Fake-timer suite covers all five behaviors.
- [ ] `npm test`, `typecheck`, `lint` pass in `frontend/`.

**Dependencies:** None.

### T4 — Frontend: TimerCountdown + formatDuration

**Description**

- New `frontend/src/components/TimerCountdown.tsx` + test: props `{ remaining: number }`, renders `role="timer"` with seconds; urgency styling under `URGENT_SECONDS_THRESHOLD = 5` (Tailwind color utilities, no inline style); mirror `QuestionDisplay.tsx` structure/tokens.
- New `frontend/src/utils/formatDuration.ts` + test (creates `utils/`): `formatDuration(ms: number): string` → `"12s"`, `"1m 05s"` for ≥60s; deterministic guards for 0/negative/non-finite. Pure, typed, mirroring `useRelativeTime.ts` helper style (its day/hour granularity is too coarse).

**Acceptance Criteria**

- [ ] `role="timer"`, remaining seconds, Tailwind-only styling, threshold constant.
- [ ] `formatDuration` deterministic across `<1s`, seconds, `≥60s`, 0, invalid.
- [ ] Both colocated suites pass; `npm test`, `typecheck`, `lint` pass.

**Dependencies:** None.

---

## Batch 2

### T5 — API.md: `-1` sentinel + leaderboard contract sync

**Description**

Docs-only (`docs/api-docs/API.md`). Submit section: document `answers[]` entries may be `-1` (timeout sentinel, positional, always scored incorrect; other out-of-range → 400). Leaderboard section: verify defaults/caps/errors/response shape against the T2 implementation (`backend/src/routes/leaderboard.ts`) — fix doc to match code. Read the code first.

**Acceptance Criteria**

- [ ] Sentinel defined in submit spec; leaderboard section matches implementation exactly.
- [ ] No code changes.

**Dependencies:** T1, T2.

### T6 — QuizPlay: timer wiring + `-1` timeout + sparse normalization

**Description**

Modify `frontend/src/pages/QuizPlay.tsx`:

- Render `<TimerCountdown remaining={...} />` beside `<QuestionDisplay>` (`:179-181`), fed by `useQuizTimer({ seconds: session.timeLimitSeconds, active: submitState === 'idle' && result === null, onTimeout })`.
- `onTimeout` mirrors `handleAnswer` (`:91-109`) but writes `nextAnswers[seq-1] = -1`; no-op guard when `submitState !== 'idle'` or `result !== null`.
- **Sparse normalization before every submit path** (answer-submit, timeout-submit, manual retry): `Array.from({length: session.questionCount}, (_, i) => answers[i] ?? -1)` — JSON drops holes, which fails the server length check.
- `elapsedMs` unchanged. Verify the "Submitting…" section (`:133-139`) renders a loader per the locked decision; timer `active: false` covers no-tick-during-retry.

Tests — extend `QuizPlay.test.tsx` (fake timers, explicit setup/teardown): timeout auto-advances without click; last-question timeout submits `-1` positionally in captured payload; answering cancels timer; no tick during submit/retry; sparse case (timeout Q1, answer Q2 → `[-1, chosen]`, full length).

**Acceptance Criteria**

- [ ] Visible `role="timer"` per question, reset on question change.
- [ ] Timeout auto-advance + last-question `-1` submit; `onTimeout` at most once per question.
- [ ] Timer never ticks after quiz end/during retry (test-proven).
- [ ] Payload always dense, length `questionCount`, holes `-1`, including manual retry.
- [ ] `npm test`, `typecheck`, `lint` pass.

**Dependencies:** T1, T3, T4.

### T7 — Completion page + route; post-submit navigation

**Description**

- `frontend/src/App.tsx`: lazy `Completion` import + `/quizzes/:id/completion` route in `ProtectedRoute` (match `App.tsx:8-10,27-46` style).
- New `frontend/src/pages/Completion.tsx`: reads `location.state.result` (`SubmitResult`); renders "You scored {correctCount} of {totalQuestions}", `formatDuration(durationMs)`, leaderboard link, back-to-`/` link. No state → friendly "result unavailable" fallback. Page shell per QuizPlay (`:118-121`). Never shows answer data.
- `QuizPlay.tsx`: on successful submit, `navigate(`/quizzes/${session.quizId}/completion`, { state: { result: submitted } })`; remove inline score section (`:122-131`).
- Tests: new `Completion.test.tsx` (score/duration from state, fallback without state); migrate the inline-score assertion in `QuizPlay.test.tsx` to assert navigation.

Run before T8 — App.tsx conflict.

**Acceptance Criteria**

- [ ] Post-submit lands on completion page with score, duration, leaderboard link; no inline score in QuizPlay.
- [ ] No-state fallback works on reload/direct nav.
- [ ] Route lazy + protected; navigation asserted in tests.
- [ ] `npm test`, `typecheck`, `lint` pass.

**Dependencies:** T6, T4.

### T8 — Leaderboard page, service, types, route

**Description**

After T7 (App.tsx serial).

- Types (`api/types.ts`): `LeaderboardEntry { rank, name, score, durationMs }`, `LeaderboardData { quizId, page, pageSize, total, entries }`.
- Service (`api/client.ts`): `fetchLeaderboard(quizId): Promise<LeaderboardData>` — existing one-liner style; verify shape against `backend/src/routes/leaderboard.ts`.
- New `frontend/src/pages/Leaderboard.tsx`: fetch-on-mount mirroring `QuizList.tsx:16-44` (loading skeleton `aria-busy`, error + Retry, empty "No results yet"), rows rank/name/score/`formatDuration(durationMs)`, back link to completion, `useParams` quizId, TopBar + `max-w-md` shell. No pagination UI.
- `App.tsx`: lazy + `/quizzes/:id/leaderboard` protected route after completion route.
- Tests: `Leaderboard.test.tsx` with MSW handler — loading → rows rendered, error + retry recovers, empty state.

**Acceptance Criteria**

- [ ] `/quizzes/:id/leaderboard` renders ranked entries; loading/error/empty covered via MSW.
- [ ] Types match backend response exactly; route lazy + protected.
- [ ] `npm test`, `typecheck`, `lint` pass.

**Dependencies:** T2, T4, T7.
