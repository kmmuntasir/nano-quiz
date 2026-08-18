# DEL-01 · Feature · Per-question countdown timer with auto-advance

> **Source:** [`deliverables.md`](../deliverables.md) (DEL-01)
> **Original issue(s):** F-05 — Per-question timer & auto-advance (docs/features.md)

## Problem
QuizPlay advances only when the contestant answers. There is no countdown, no auto-advance on timeout, and no timeout-triggered submit on the last question. `timeLimitSeconds` returned by start is unused, and no `useQuizTimer` hook or `TimerCountdown` component exists — F-05 is fully greenfield.

## Solution (end-to-end)
- **`useQuizTimer` hook** (`frontend/src/hooks/useQuizTimer.ts`): countdown from the quiz's `timeLimitSeconds` (from the start response). API: exposes remaining seconds, running/paused state, and a `setTimeout`-style completion. Resets per question; single instance owned by QuizPlay.
- **`TimerCountdown` component** (`frontend/src/components/TimerCountdown.tsx`): visible per-question countdown (seconds remaining), styled with Tailwind theme tokens; accessible (`role="timer"` or equivalent). Rendered on each question screen.
- **QuizPlay wiring:** on timer completion:
  - Non-final question → record sentinel `-1` for that question in the answers array (locked decision) and auto-advance to the next question (fresh timer).
  - Final question → record `-1` and end the quiz, triggering the existing submit path.
  - Answering before timeout → clear/cancel the timer for that question, then advance (existing answer-to-advance behavior).
- **Elapsed time:** keep the existing `Date.now() - startedAt` measurement — total quiz elapsed, carried through to submit as `elapsedMs` (per-question timer does not feed elapsedMs).
- **Timer lifecycle:** timer is stopped/destroyed when the quiz ends (including when a submit retry is pending — no ticking timer during retry; see DEL-02).
- **Tests:** hook + component tests with Vitest fake timers (explicit setup/teardown); QuizPlay tests for auto-advance on timeout, timeout-on-last-question triggers submit with `-1`, timer cleared on answer.

## Acceptance criteria
- A visible countdown appears on each question and uses the quiz's configured time limit (start response `timeLimitSeconds`, default 15).
- On timeout the quiz advances to the next question automatically, and on the last question timeout ends the quiz and triggers submit.
- Timed-out questions are recorded as `-1` in the answers array; positional mapping is preserved.
- Elapsed time measured client-side is carried through to the final submit payload (`elapsedMs`).
- The timer does not keep firing after the quiz ends or while a submit retry is pending.

## Dependencies
None (foundational for DEL-02, DEL-03).
