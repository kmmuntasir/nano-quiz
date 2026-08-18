# Implementation Plan — DEL-01/02/03 (F-05, F-06, F-07)

**Tickets:** `DEL-01-per-question-timer.md`, `DEL-02-final-submit-hardening.md`, `DEL-03-score-result-screen.md`
**Type:** Feature (DEL-01, DEL-03) + Enhancement (DEL-02) — combined plan, one build order
**Title:** Per-question timer & auto-advance, submit hardening (`-1` sentinel + loader), completion screen + minimal leaderboard
**Generated:** 2026-08-18

---

## Summary

Three deliverables completing the contestant play loop. DEL-01: a `useQuizTimer` countdown hook + `TimerCountdown` component wired into QuizPlay — timeout records the `-1` sentinel and auto-advances (last question → submit). DEL-02: backend accepts `-1` in the submit answers array (scored incorrect), frontend shows a loader while submitting/retrying, API.md documents the sentinel. DEL-03: dedicated `/quizzes/:id/completion` page (score, duration, leaderboard link) replacing QuizPlay's inline score, plus a minimal `/quizzes/:id/leaderboard` page.

**Correction to DEL-03's premise:** the leaderboard endpoint `GET /api/quizzes/:id/leaderboard` does **not** exist yet (only `auth`, `quizzes`, `health` routes are mounted — `backend/src/index.ts:46-48`). API.md:140-156 specifies its contract. This plan includes building it; scope is the minimal page-shaped query (page 1, no pagination UI).

## Affected Components

| Layer | File | Why |
|-------|------|-----|
| Hook | `frontend/src/hooks/useQuizTimer.ts` (new) | Per-question countdown, reset, cancel |
| Component | `frontend/src/components/TimerCountdown.tsx` (new) | Visible countdown, `role="timer"` |
| Page | `frontend/src/pages/QuizPlay.tsx` | Wire timer, `-1` on timeout, loader, navigate to completion |
| Route | `frontend/src/App.tsx` | Add completion + leaderboard routes |
| Page | `frontend/src/pages/Completion.tsx` (new) | Score, duration, links |
| Page | `frontend/src/pages/Leaderboard.tsx` (new) | Minimal ranked list |
| Types/API | `frontend/src/api/types.ts`, `frontend/src/api/client.ts` | `LeaderboardData`/`LeaderboardEntry` + `fetchLeaderboard` |
| Route | `backend/src/routes/leaderboard.ts` (new) | `GET /api/quizzes/:id/leaderboard` |
| Route | `backend/src/routes/quizzes.ts` | Accept `-1` sentinel in submit validation |
| DB | `backend/src/db/quizzes.ts` | Leaderboard query helper |
| Docs | `docs/api-docs/API.md` | Document `-1` sentinel |
| Util | `frontend/src/utils/formatDuration.ts` (new) | `durationMs → "12s"` formatter |

## Proposed Implementation

### Backend Changes

**B1. Accept `-1` sentinel in submit** — `backend/src/routes/quizzes.ts`
- The answers predicate at `quizzes.ts:256` (`a >= 0 && a < optionCount`) becomes `a === -1 || (a >= 0 && a < optionCount)` — per-question bounds preserved (`quizzes.ts:246-252`).
- Scoring needs no change: `scoreAndStore` compares `answers[i] === question.correctOpt` (`quizzes.ts:191`) and `correct_opt >= 0`, so `-1` never matches. `-2` and fractions still 400.
- Tests (`backend/tests/submit.test.ts`): `-1` entries → 200, scored incorrect; `-2` → 400; mixed `-1` + valid answers keep positional scoring; existing out-of-bounds test (`:208-217`) unaffected (uses `9`).

**B2. Leaderboard endpoint** — `backend/src/routes/leaderboard.ts` (new), mounted at `/api/quizzes` scope or its own router in `index.ts`
- `GET /api/quizzes/:id/leaderboard?page=1&pageSize=20` per API.md:140-156, behind `requireAuth`.
- `404 NOT_FOUND` unknown quiz. Validate `page`/`pageSize` positive integers (default 1/20, cap pageSize at e.g. 100) → `400 VALIDATION_ERROR` on malformed.
- DB helper in `backend/src/db/quizzes.ts` (or `db/leaderboard.ts`): `JOIN users ON users.id = participations.user_id`, `SELECT users.name, score, duration_ms`, `ORDER BY score DESC, duration_ms ASC`, `LIMIT ? OFFSET ?`; `COUNT(*)` for `total`. Prepared statements, module load.
- Response: `{ quizId, page, pageSize, total, entries: [{ rank, name, score, durationMs }] }` — rank computed as `offset + index + 1` (sequential; tie-break implicit in ORDER BY). No `correct_opt`, no answer data.
- Tests: `backend/tests/leaderboard.test.ts` — ordering (score DESC, duration ASC), rank numbering across pages, empty leaderboard, 404, 400 malformed page params, 401.

**B3. API.md** — document `-1` as the timeout sentinel in the submit payload spec; confirm leaderboard section matches B2's implementation (it's spec'd but was never built — verify defaults/caps).

### Frontend Changes

**F1. `useQuizTimer` hook** — `frontend/src/hooks/useQuizTimer.ts`
- API: `useQuizTimer({ seconds, active, onTimeout })` → `{ remaining, ... }`. `setInterval`/`setTimeout` at 1s granularity (or 250ms tick computing remaining from a deadline for accuracy); resets when `seconds` key/`seq` changes (QuizPlay re-invokes per question — design for reset-on-mount or accept a `resetKey` param).
- `active: boolean` — false while `submitState !== 'idle'` or `result !== null`; inactive = paused/destroyed, no further `onTimeout` (DEL-01 AC: timer never fires after quiz ends or during retry).
- `onTimeout` fires exactly once per question; answering cancels (component unmounts/advances → effect cleanup).
- Colocated test with Vitest fake timers (explicit `vi.useFakeTimers()` setup/teardown per testing rules).

**F2. `TimerCountdown` component** — `frontend/src/components/TimerCountdown.tsx`
- Props: `{ remaining: number }` (seconds). Renders `role="timer"` with remaining seconds; Tailwind tokens; urgency styling (e.g. red under a threshold constant) optional — keep minimal.
- Colocated test: renders remaining, role assertion.

**F3. QuizPlay wiring** — `frontend/src/pages/QuizPlay.tsx`
- Render `<TimerCountdown>` alongside `<QuestionDisplay>` (`:179-181`), fed by `useQuizTimer({ seconds: session.timeLimitSeconds, active: submitState === 'idle' && result === null, onTimeout })`.
- `onTimeout` mirrors `handleAnswer`'s advance-or-submit (`:91-109`) but writes `nextAnswers[seq-1] = -1` (sentinel; positional mapping preserved — answers array may be sparse, `nextAnswers[seq-1] = -1` on sparse array works).
- Guard timeouts while `submitState !== 'idle'` (double-fire safety).
- `elapsedMs` unchanged: `Date.now() - startedAt.current` (`:60-89`).
- **Submit loader (DEL-02):** while `submitState === 'submitting'` the page already shows a "Submitting…" section (`:133-139`) — verify it renders a spinner/loader per the locked decision and that no timer/question UI ticks (timer `active: false` covers it). Manual Retry (`:141-154`) resubmits the same payload — already correct.
- **Completion navigation (DEL-03):** after successful submit, replace the inline score section (`:122-131`) with `navigate(`/quizzes/${session.quizId}/completion`, { state: { result } })`.

**F4. Completion page + route** — `frontend/src/pages/Completion.tsx`, `App.tsx`
- Route `/quizzes/:id/completion`, `ProtectedRoute`-wrapped, lazy per `App.tsx:8-10,28-44` pattern.
- Reads `location.state.result` (`SubmitResult`); renders score `{correctCount} of {totalQuestions}`, duration via `formatDuration(durationMs)`, link to `/quizzes/:id/leaderboard`, link back to `/`.
- No state (reload/direct nav) → friendly "result unavailable" + back-to-quizzes fallback (results aren't re-fetchable).
- Removes QuizPlay's inline score display.

**F5. Leaderboard page + service** — `frontend/src/pages/Leaderboard.tsx`, `api/client.ts`, `api/types.ts`
- Types: `LeaderboardEntry { rank: number; name: string; score: number; durationMs: number }`, `LeaderboardData { quizId: string; page: number; pageSize: number; total: number; entries: LeaderboardEntry[] }`.
- `fetchLeaderboard(quizId: string): Promise<LeaderboardData>` — service one-liner style (`client.ts:14-118`).
- Page: fetch-on-mount pattern mirroring `QuizList.tsx:16-44` (loading skeleton, error + Retry, empty state), ranked rows (rank, name, score, duration via `formatDuration`), back link to `/quizzes/:id/completion` (or `/` on direct nav — plain `Navigate`/link back suffices). No pagination UI.
- `formatDuration(ms: number): string` in `frontend/src/utils/formatDuration.ts` + colocated test — `useRelativeTime`'s day/hour granularity is too coarse (`hooks/useRelativeTime.ts`).

**F6. Tests** — extend `QuizPlay.test.tsx` (fake timers from the start: advance by `timeLimitSeconds`, assert auto-advance without click, last-question timeout submits with `-1` in captured payload, timer cleared on answer, no tick during submit retry); new `Completion.test.tsx`, `Leaderboard.test.tsx` (MSW handler for leaderboard; loading/error/empty; duration rendering; state-missing fallback).

**Build order:** B1 → B2 → B3 (backend) can run parallel to F1 → F2 (frontend greenfield). F3 needs F1/F2 + B1 (sentinel contract). F4 after F3. F5 needs B2 + types. F6 throughout.

## Edge Cases & Risks

- **Double-fire timeout**: `onTimeout` must be idempotent per question (answering at the same tick as timeout) — guard with a fired-flag or the `active` boolean.
- **Sparse answers array**: timeouts create holes before later answers; `nextAnswers[seq-1] = -1` fills them; submit payload must not contain `undefined` (JSON drops holes → length check fails server-side). Mitigation: QuizPlay normalizes the array before submit (fill any holes with `-1`).
- **Timer during retry**: `active` gate on `submitState`/`result`; verified by test.
- **Leaderboard privacy**: shows display names only (users.name) — no emails. Endpoint is auth-only (any signed-in user), matching API.md.
- **Rank ties**: sequential ranks via offset+index — matches spec's implicit tie-break (duration ASC).
- **Existing tests**: T9's completion-screen test asserts the inline "You scored" in QuizPlay — F3/F4 replace it with navigation; update in same change (same lesson as T8).
- **StrictMode double-effect**: `useQuizTimer`'s interval setup must clean up correctly on double-mount (dev only).

## Testing

- **Backend unit/HTTP**: submit `-1` accepted + scored incorrect, `-2`/fraction 400, mixed positional scoring; leaderboard ordering/pagination/rank/empty/404/400/401.
- **Frontend**: `useQuizTimer` fake-timer suite (countdown, reset, cancel, single fire); `TimerCountdown` render; QuizPlay timeout auto-advance, last-question `-1` submit, timer stops during retry; Completion render + fallback; Leaderboard MSW loading/error/empty.
- **Manual**: play `quiz-live-gk` — let a question time out, answer the rest, land on completion with duration, open leaderboard.

## Acceptance Criteria

- [ ] Visible countdown per question using `timeLimitSeconds`; `role="timer"`.
- [ ] Timeout auto-advances; last-question timeout submits with `-1` recorded positionally.
- [ ] Timer never ticks after quiz end or during submit retry.
- [ ] Backend accepts `-1` (scored incorrect), rejects other out-of-range values with 400; API.md documents the sentinel.
- [ ] Loader shown while submitting/retrying; manual retry resubmits identical payload.
- [ ] Repeat submit still returns stored result (idempotency intact).
- [ ] Post-submit navigates to `/quizzes/:id/completion` showing score, duration, leaderboard link; graceful fallback without state.
- [ ] `/quizzes/:id/leaderboard` renders ranked entries (score DESC, duration ASC) with loading/error/empty states.
- [ ] No `correct_opt`, per-question correctness, or answer key in any response or UI.
- [ ] All backend + frontend suites, typecheck, lint pass.

## Open Questions

- Leaderboard `pageSize` cap value (100 assumed) and whether non-positive `page` should 400 or clamp — assumed 400 + default fallbacks; adjust if owner prefers clamping.

## Out of Scope

- Leaderboard pagination UI (F-10), admin leaderboard (A-09), admin routes generally, quiz-list score refresh after completion (F-08 surface), `elapsedMs` per-question breakdown.
