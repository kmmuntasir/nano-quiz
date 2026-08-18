# DEL-01 · Enhancement · Single participation lock — verification & test hardening

> **Source:** [`deliverables.md`](../deliverables.md) (DEL-01)
> **Original issue(s):** "F-08 — Single participation lock" (docs/features.md)

## Problem
F-08 requires that each participant gets exactly one attempt per quiz: Start permanently disabled after completion, the quiz list shows participation and score, and a forced start returns 409 surfaced in the UI. The behavior is already implemented (shipped with F-04..F-07), but it lacks dedicated regression coverage — the lock could silently regress without a failing test.

Existing implementation (verified):
- `backend/src/routes/quizzes.ts` `startQuiz`: 409 `ALREADY_PARTICIPATED` after participation check.
- `GET /api/quizzes`: `participated`, `userScore`, `canStart` per quiz via LEFT JOIN (`backend/src/db` `listForUser`).
- `frontend/src/components/StartQuizButton.tsx`: disabled when `participated`, showing "You scored X/N".
- `frontend/src/pages/QuizList.tsx`: refetches on mount, `visibilitychange`, and after a failed start.

## Solution (end-to-end)
This is a verification/hardening deliverable — no new product behavior.

**Backend tests (supertest, HTTP-level):**
- `POST /api/quizzes/:id/start` after a completed submit → 409 with `ALREADY_PARTICIPATED`; body uses the standard error envelope.
- `GET /api/quizzes` for a user with a completed attempt → that quiz has `participated: true`, `canStart: false`, `userScore` equal to the scored result.
- Order-independence: the 409 fires regardless of active window state (participated user outside window still gets 409, not 403 confusion — assert whichever the route currently returns, documented in the test name).
- Confirm no answer-key leakage in any of these responses.

**Frontend tests (Testing Library + MSW):**
- QuizList renders a participated quiz with Start disabled and the score label visible.
- When a start call is mocked to reject with 409 `ALREADY_PARTICIPATED`, the UI surfaces the error and refetches the quiz list (stale `canStart` corrected).
- After returning from Completion (QuizList remount), the participated state and score come from the fresh fetch.

**Manual verification checklist (recorded in the PR):**
- Finish a quiz → Start disabled on the list with score shown; direct API start returns 409.

## Acceptance criteria
- All three F-08 acceptance criteria in docs/features.md pass, each backed by at least one automated test:
  - Start permanently disabled after finishing a quiz.
  - Quiz list shows participated state with the user's score.
  - Forced start on a completed quiz returns 409 and the UI surfaces it.
- No regression in existing start/submit suites (`cd backend && npm test`, `cd frontend && npm test` green).
- No changes to API contracts or schema.

## Dependencies
None (foundational; builds on merged F-04..F-07).
