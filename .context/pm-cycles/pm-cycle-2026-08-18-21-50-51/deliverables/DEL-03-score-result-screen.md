# DEL-03 · Feature · Score result screen with duration, leaderboard link, and minimal leaderboard page

> **Source:** [`deliverables.md`](../deliverables.md) (DEL-03)
> **Original issue(s):** F-07 — Score result screen (docs/features.md)

## Problem
After a successful submit, QuizPlay shows only a minimal inline "You scored X of Y" — no duration, no leaderboard link, no dedicated destination. No Completion or Leaderboard page/route exists, even though the backend `GET /api/quizzes/:id/leaderboard` endpoint is live.

## Solution (end-to-end)
- **Completion page** (`frontend/src/pages/Completion.tsx`, route `/quizzes/:id/completion`, lazy-loaded with Suspense + ErrorBoundary per App.tsx convention):
  - Shows score and question total from the submit result (`correctCount` / `totalQuestions`).
  - Shows total duration (`durationMs`, formatted readably — reuse/extend `useRelativeTime`-style formatting only if it fits; otherwise a simple formatter).
  - Link/button to `/quizzes/:id/leaderboard` and a way back to the quiz list (`/`).
  - Never displays correct answers, per-question correctness, or any answer key.
- **State handoff:** QuizPlay navigates to the completion route after a successful submit, passing the `SubmitResult` (location state or equivalent local mechanism — no new server endpoint; a reload without state falls back to a friendly "result unavailable, back to quizzes" state, since results are not re-fetchable). The inline score display in QuizPlay is removed.
- **Minimal Leaderboard page** (`frontend/src/pages/Leaderboard.tsx`, route `/quizzes/:id/leaderboard`, lazy-loaded):
  - Fetches `GET /api/quizzes/:id/leaderboard` via the shared Axios client (typed service function) and renders the ranked list (rank, name/identifier, score, duration) with loading, error, and empty states.
  - Back link to the completion page or quiz list. No admin tooling, no pagination — that belongs to the future leaderboard feature.
- **Tests:** Completion renders score/total/duration/leaderboard link and no answer data; Leaderboard renders fetched rows via MSW, covers loading/error/empty; routing tests for both new routes.

## Acceptance criteria
- After submit, the participant lands on `/quizzes/:id/completion` and sees their score and question total.
- The total duration is shown.
- No correct-answer key or per-question breakdown is displayed anywhere.
- The result screen links to the quiz's leaderboard, and `/quizzes/:id/leaderboard` renders a working minimal leaderboard backed by the existing endpoint.

## Dependencies
DEL-01, DEL-02 (the flow must be complete before the result destination is meaningful).
