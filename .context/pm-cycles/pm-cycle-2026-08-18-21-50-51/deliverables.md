# NanoQuiz — Deliverables (F-05 / F-06 / F-07)

> Source of truth for this delivery cycle. Each item is a single,
> **complete, end-to-end** deliverable — a feature, a bugfix, or an enhancement.
> No deliverable is split by layer: if a requirement touches data, APIs, and UI,
> it all ships together as one unit.
>
> Status legend: 🔴 not started · 🟡 in progress · 🟢 done. All items 🔴 unless marked.

---

## Table of Contents
1. Context & Locked Decisions
2. Glossary
3. Deliverables Index
4. Dependency Graph & Suggested Phasing
5. Cross-Cutting Concerns

---

## Context & Locked Decisions

Scope note: F-04 already shipped seeded shuffle, question fetch, server-side scoring submit with idempotent resubmit, and a minimal inline "You scored X of Y". These deliverables cover what REMAINS of F-05/F-06/F-07.

### Result screen (F-07)
- Result lives on a dedicated route `/quizzes/:id/completion` (separates play state from result state; stable post-quiz destination). The inline score display in QuizPlay is replaced by navigation to this page.
- The leaderboard link is real: ship a minimal leaderboard page at `/quizzes/:id/leaderboard` (fetch + list via existing `GET /api/quizzes/:id/leaderboard`) so the F-07 link is not dead. No gold-plating.

### Timer behavior (F-05)
- Timed-out questions are recorded in the answers array as sentinel `-1` (preserves positional mapping; backend treats non-option values as incorrect). Backend submit validation must accept `-1` and score it as incorrect.
- The countdown stops once the quiz ends and a submit retry is pending; while retrying, a loader is shown (no ticking timer, no double-fire).

### Already satisfied (verification only)
- `elapsedMs` is measured client-side (`Date.now() - startedAt`) and sent in the submit payload.
- Submit retry: auto-retry 3x / 1s backoff on network failure + manual retry button; resubmit returns the stored result (idempotent).

## Glossary

| Term | Meaning |
| --- | --- |
| seed | Random value from `POST /quizzes/:id/start`; deterministically derives the contestant's question order |
| sentinel `-1` | Answers-array entry for a timed-out (unanswered) question |
| elapsedMs | Client-reported total duration, used only for the leaderboard |
| idempotent submit | Re-submitting a completed quiz returns the stored result instead of double-scoring |

## Deliverables Index

| ID | Type | Title | Blocked by |
| --- | --- | --- | --- |
| [DEL-01](deliverables/DEL-01-per-question-timer.md) | Feature | Per-question countdown timer with auto-advance (F-05) | — |
| [DEL-02](deliverables/DEL-02-final-submit-hardening.md) | Enhancement | Final submit & retry hardening: sentinel handling + retry loader (F-06 remainder) | DEL-01 |
| [DEL-03](deliverables/DEL-03-score-result-screen.md) | Feature | Score result screen with duration, leaderboard link, and minimal leaderboard page (F-07) | DEL-01, DEL-02 |

## Dependency Graph & Suggested Phasing

```text
DEL-01 (timer + auto-advance)
   └──> DEL-02 (submit hardening: -1 sentinel, retry loader)
          └──> DEL-03 (completion route + leaderboard page)
```

**Suggested phasing**
- **Phase 1 — timer:** DEL-01 (greenfield `useQuizTimer` + `TimerCountdown`)
- **Phase 2 — submit:** DEL-02 (small backend validation change + frontend loader)
- **Phase 3 — result:** DEL-03 (Completion + minimal Leaderboard pages/routes)

## Cross-Cutting Concerns
- **Anti-cheat:** `correct_opt`, per-question correctness, and the answer key are never sent to the client — including the new completion and leaderboard screens.
- **Timer tests:** Vitest fake timers for countdown/auto-advance; explicit, no leakage between tests.
- **Theme/styling:** Tailwind utilities + theme tokens only; one component per file, co-located tests.
- **Backend contract:** any payload change (accepting `-1`) stays within the documented error envelope and `docs/api-docs/API.md` spec.
- **Routing:** lazy-loaded routes with Suspense + ErrorBoundary, matching App.tsx convention.
