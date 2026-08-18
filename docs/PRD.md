# NanoQuiz — Product Requirements Document

A dead simple quiz platform.

## Users

- Users log in with Google OAuth.
- After login they see a quiz list. Each quiz has a title, description, and a Start button.
- All quizzes are visible. Inactive quizzes (outside their active window) show a disabled Start button; upcoming quizzes are also shown.

## Admin

- An env bootstrap identifies admins: `ADMIN_EMAILS` (comma-separated email list), checked live against the env on each request.
- Admins log in with the same Google OAuth. The JWT carries an `isAdmin` claim so the frontend can hide admin UI entirely from non-admins.
- Admins can create quizzes, add questions, configure the per-quiz time limit, and view the leaderboard.
- Admins can delete a quiz (cascades all its data). A quiz with recorded attempts cannot be edited; otherwise all quiz settings and question content are editable.

## Quiz lifecycle

- Each quiz has a start and end datetime. Users can only participate in quizzes whose active window contains the current time.
- Question order is randomized per contestant. The admin sets how many questions are shown per quiz (e.g. 100 questions in the bank, quiz shows 10 randomized questions to each contestant).
- `questionCount` cannot exceed the current bank size (validation at save).

## Attempt flow

- Starting a quiz returns a random seed. The client sends it with every question fetch; the server runs a deterministic PRNG seeded with it to pick the shuffled question IDs, so the sequence is reproducible server-side with no storage.
- Questions are fetched one at a time (`GET /quiz/:quizId/question/:seq`). No correct answers are ever sent to the frontend.
- Each question has multiple choice answers. The user selects an answer and submits to move to the next question.
- The time limit (default 15s, configurable per quiz) is enforced client-side. On timeout the quiz auto-advances, including on the last question, which ends the quiz.
- No mid-way storage: a user who abandons (closes the tab) leaves no record and must start over. A completed attempt counts as participation and disables the Start button permanently.
- No backtracking: answered questions cannot be revisited.
- On completion the client submits all answers plus the reported elapsed time in a single final API call. The final submit has a retry mechanism with a manual retry button.

## Scoring & leaderboard

- Scoring is server-side. Ranking follows score DESC, duration ASC.
- After completing, the user sees their score but never the correct answers.
- Each quiz has a leaderboard showing score, total time taken, and the Google profile name, with pagination. Admins can view it but not modify it.

## Tech stack & deployment

- Backend: Express.js (TypeScript), SQLite via `better-sqlite3` (single-file DB, single process).
- Frontend: React.js (TypeScript) + Tailwind CSS.
- Auth: Google OAuth 2.0 + app JWT (2h expiry).
- Separate frontend and backend builds. Deployment is a single Linux VPS: nginx serves the React build and reverse-proxies `/api` to the Express process, run via PM2/systemd.