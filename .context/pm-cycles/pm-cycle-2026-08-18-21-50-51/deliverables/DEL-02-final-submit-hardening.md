# DEL-02 · Enhancement · Final submit & retry hardening: sentinel handling + retry loader

> **Source:** [`deliverables.md`](../deliverables.md) (DEL-02)
> **Original issue(s):** F-06 — Final submit & retry (docs/features.md); remainder after F-04 shipped the core submit + retry

## Problem
The core of F-06 already shipped inside F-04: single submit with `{ seed, answers, elapsedMs }`, server-side scoring, auto-retry 3x / 1s backoff on network failure + manual retry button, and idempotent resubmit returning the stored result. What remains:
1. The submit endpoint's answers validation has not been verified (and likely rejects) the `-1` sentinel for timed-out questions introduced by DEL-01.
2. During a pending submit / retry wait, the UI has no loading state (locked decision: show a loader; timer must not keep firing).

## Solution (end-to-end)
- **Backend validation** (`backend/src/routes/quizzes.ts` submit handler): accept answers-array entries of `-1` alongside valid option indices; score `-1` as incorrect (it is a non-option value). Reject anything else with `400` + the standard error envelope. `correct_opt` still never leaves the server; no per-question correctness in any response.
- **Retry loader (frontend):** while a submit (or retry — auto or manual) is pending, QuizPlay shows a loading state (spinner/"Submitting…" via Tailwind) instead of any interactive question UI or ticking timer. Retry button remains available after exhaustion, resubmitting the exact same payload.
- **Idempotency check:** confirm resubmitting an already-completed quiz returns the stored `{ score, totalQuestions, correctCount, durationMs, participated }` and does not double-score — verify with tests, fix if broken.
- **Docs:** update `docs/api-docs/API.md` submit payload spec to document `-1` as the timeout sentinel.
- **Tests:** backend supertest — submit with `-1` entries returns 200 and scores them as incorrect; invalid sentinels (e.g. `-2`, out-of-range) return 400; repeat submit returns stored result. Frontend — loader shown while submitting/retrying; manual retry resubmits identical payload.

## Acceptance criteria
- The final answer (or timeout) triggers a single submit containing the seed, the answers array (with `-1` for timed-out questions), and `elapsedMs`.
- A failed submit shows a retry button; retrying resubmits the same answers and succeeds; while retrying, a loader is shown and the timer is stopped.
- The server scores server-side; the response contains the score but never the correct answers or per-question correctness.
- Resubmitting an already-completed quiz returns the stored result instead of double-scoring.

## Dependencies
DEL-01 (the `-1` sentinel originates from the timer's auto-advance).
