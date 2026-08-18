# DEL-02 · Enhancement · Abandon & restart — verification & test hardening

> **Source:** [`deliverables.md`](../deliverables.md) (DEL-02)
> **Original issue(s):** "F-09 — Abandon & restart (no mid-way storage)" (docs/features.md)

## Problem
F-09 requires that abandoning a quiz mid-way leaves no trace and the quiz remains startable from question 1 with a fresh seed/order. This is satisfied by construction (start only mints a random seed; nothing persists until the final submit — verified in `backend/src/routes/quizzes.ts`), but there is no dedicated test suite proving the invariant across the full flow, so a future change (e.g. caching in-flight attempts) could break it silently.

## Solution (end-to-end)
Verification/hardening deliverable — no new product behavior.

**Backend tests (supertest):**
- Start a quiz, fetch one or more questions, never submit → `GET /api/quizzes` still shows `participated: false` / `canStart: true`; leaderboard endpoint shows no entry for the user; no `participations` row exists.
- Start again after abandoning → succeeds with a new 200 response and a **different seed** (fixed-seed test discipline: control randomness where the assertion needs determinism, otherwise assert inequality).
- Two consecutive starts without submit are both allowed (no conflict).
- Question fetch with an abandoned/invalid seed still follows existing validation rules (no state leak).

**Frontend tests (Testing Library + MSW):**
- Navigating away from QuizPlay (unmount) and returning to QuizList shows Start still enabled.
- Restarting renders question 1 with a fresh session (new seed from mocked start).

**Manual verification checklist (recorded in the PR):**
- Close the tab mid-quiz, reopen → quiz startable from question 1; no leaderboard entry; Start not disabled.

## Acceptance criteria
- All three F-09 acceptance criteria in docs/features.md pass, each backed by automated tests:
  - Closing the tab mid-quiz leaves no attempt record.
  - Returning to the app, the quiz is startable again from question 1 (fresh seed).
  - A started-but-unsubmitted quiz never disables Start.
- Both test suites green; no contract or schema changes.

## Dependencies
None (foundational; builds on merged F-04..F-07).
