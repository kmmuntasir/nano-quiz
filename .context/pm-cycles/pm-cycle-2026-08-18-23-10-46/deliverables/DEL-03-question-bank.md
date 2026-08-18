# DEL-03 · Feature · Question bank management & publish gating

> **Source:** [`deliverables.md`](../deliverables.md) (DEL-03)
> **Original issue(s):** A-04 Question bank: add question · A-07 Edit / delete a question · A-05 Publish a playable quiz (questionCount vs bank)

## Problem
Admins cannot populate quizzes with questions. `GET/POST /api/admin/quizzes/:id/questions` and `PUT/DELETE /api/admin/quizzes/:id/questions/:questionId` are spec'd but unimplemented, so no quiz can reach a playable state (bank ≥ questionCount) and `correct_opt` has no sanctioned admin-only channel.

## Solution (end-to-end)
- **`POST /api/admin/quizzes/:id/questions`** — body `{ text, options, correctOpt }`. Validate: non-empty text, ≥2 options, `correctOpt` indexes a valid option. `201` with created question. `400` on validation failure; `404` unknown quiz.
- **`GET /api/admin/quizzes/:id/questions`** — full bank including `correctOpt` (admins legitimately see the answer key here; this is the ONLY endpoint that ever returns it).
- **`PUT /api/admin/quizzes/:id/questions/:questionId`** — same validation; `409` if the quiz has any attempt; `404` unknown quiz/question.
- **`DELETE /api/admin/quizzes/:id/questions/:questionId`** — `409` if attempts; `404` otherwise missing.
- **Publish gating**: quiz is startable only when bank size ≥ `questionCount` — surface this in admin UI ("3/5 questions — not yet playable") and in the existing `POST /api/quizzes/:id/start` path (reject with 403 when under-populated if not already enforced).
- **Frontend — question bank page** (`/admin/quizzes/:id/questions`): list of questions with options and correct answer highlighted (admin-only view); add-question form; edit inline/modal; delete with confirm; blocked actions disabled with an explanatory note once attempts exist; header shows bank size vs questionCount and playable status.
- **Tests**: backend supertest — add happy path + each 400 validation, 409 edit/delete after attempts, list includes correctOpt; regression: contestant `GET /api/quizzes/:id/question/:seq` response contains no correct-answer field. Frontend — list/form rendering, validation errors, blocked-state messaging via MSW.

## Acceptance criteria
- Admin can build a question bank and see correct answers; contestant endpoints never expose `correct_opt` (asserted by tests).
- Once bank ≥ questionCount the quiz is startable by contestants; below that it is not.
- Question edits and deletes are rejected with 409 after the first attempt; UI reflects the locked state.
- Malformed questions (fewer than 2 options, out-of-range correctOpt, empty text) are rejected with 400.

## Dependencies
DEL-02 (quiz exists to attach questions to; admin list links here).
