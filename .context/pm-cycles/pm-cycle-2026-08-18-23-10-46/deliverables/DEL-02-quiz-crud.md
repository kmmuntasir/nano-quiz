# DEL-02 · Feature · Admin quiz CRUD — create, list, edit, delete (cascade)

> **Source:** [`deliverables.md`](../deliverables.md) (DEL-02)
> **Original issue(s):** A-02 Create a quiz · A-03 Admin quiz list · A-06 Edit a quiz · A-08 Delete a quiz (cascade) · A-05 (questionCount-vs-bank validation on save)

## Problem
Only the contestant surface exists. Admins cannot create, view, edit, or delete quizzes: `POST/GET/PUT/DELETE /api/admin/quizzes*` are spec'd in `docs/api-docs/API.md` but unimplemented, and there is no admin UI for quiz management.

## Solution (end-to-end)
- **`POST /api/admin/quizzes`** — body `{ title, description, questionCount, timeLimitSeconds, startAt, endAt }`. Validate at route edge: title present, `questionCount` positive integer, `endAt > startAt`, `questionCount` ≤ current bank size (0 on create). Insert via prepared statement; return `201` with the created quiz. `400` + error envelope on validation failure.
- **`GET /api/admin/quizzes`** — every quiz with settings plus `questionBankSize` (COUNT over questions) and `attemptCount` (COUNT over participations, grows as submits land) and an `editable` flag (attemptCount === 0).
- **`PUT /api/admin/quizzes/:id`** — same body/validation as create (including `questionCount` ≤ bank size). `404` unknown id; `409` if the quiz has any attempt; `400` validation.
- **`DELETE /api/admin/quizzes/:id`** — allowed even with attempts; cascades quiz → questions → participations (schema already has ON DELETE CASCADE; wrap in `db.transaction()` with rollback). `404` unknown id.
- **Frontend — Admin quiz list page** (`/admin`): table of quizzes with settings, bank size, attempts, editable badge; actions per row: Edit (only when editable), Delete (with confirm), Manage Questions (routes to DEL-03), Leaderboard (routes to DEL-04).
- **Frontend — create/edit quiz form**: controlled components, local state, simple validation mirroring server rules; submit via typed service functions matching the API contract exactly.
- **Tests**: backend supertest — create happy path + each 400 validation, edit 409 with attempts, delete cascade (questions/participations gone), list fields accurate; frontend Testing Library + MSW — list rendering, form validation, 409/404 error display, confirm-delete flow.

## Acceptance criteria
- Admin can create a quiz that then appears in both the admin list and the participant quiz list.
- Admin list shows settings, bank size, attempt count, and editable flag for every quiz.
- Editing a quiz with attempts returns 409 and the UI explains why; delete still succeeds and removes quiz, questions, attempts, and leaderboard entries atomically.
- `questionCount` > bank size is rejected on create and edit (validation at save).
- All endpoints return 401/403 for missing/non-admin tokens (DEL-01 middleware).

## Dependencies
DEL-01 (require-admin middleware + admin shell/routes).
