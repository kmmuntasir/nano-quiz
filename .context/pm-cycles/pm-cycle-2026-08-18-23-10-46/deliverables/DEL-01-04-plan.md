# Implementation Plan — DEL-01..04 (A-01..A-09, admin features)

**Tickets:** `DEL-01-admin-foundation.md`, `DEL-02-quiz-crud.md`, `DEL-03-question-bank.md`, `DEL-04-admin-leaderboard.md`
**Type:** Feature (all four)
**Title:** Admin foundation, quiz CRUD, question bank & publish gating, admin leaderboard
**Generated:** 2026-08-18

---

## Summary

Build the entire admin surface. DEL-01: `require-admin` middleware (the real security boundary), admin router mount, `ProtectedRoute requireAdmin`, lazy `/admin` shell, conditional TopBar admin link. DEL-02: admin quiz CRUD (`POST/GET/PUT/DELETE /api/admin/quizzes`) with attempt-based edit blocking, bank-size validation, transactional cascade delete, plus the admin quiz-list page and create/edit form. DEL-03: question bank CRUD under `/api/admin/quizzes/:id/questions` — the only channel where `correctOpt` legitimately leaves the server — plus the question-management UI with publish-gating status. DEL-04: read-only admin leaderboard endpoint reusing the public queries, and an admin leaderboard view composing an extracted leaderboard table component.

Key code facts driving the design: `requireAuth` already sets `req.isAdmin` (`backend/src/middleware/auth.ts:68-69`); no quiz/question insert/update/delete statements exist; **`participations` FK lacks ON DELETE CASCADE** (`schema.ts:34-41`) so quiz delete must explicitly remove participations in a transaction (questions cascade via `schema.ts:26`); spec uses question field `text` vs DB column `prompt` (map as `routes/quizzes.ts` already does); start already rejects under-populated quizzes with 409 `INSUFFICIENT_QUESTIONS` (`routes/quizzes.ts:75-80`).

## Affected Components

| Layer | File | Why |
|-------|------|-----|
| Middleware | `backend/src/middleware/require-admin.ts` (new) | 403 gate on `req.isAdmin` |
| Route | `backend/src/routes/admin/quizzes.ts` (new) | All admin endpoints |
| Mount | `backend/src/index.ts` | `/api/admin/quizzes` |
| DB | `backend/src/db/quizzes.ts` | insert/update/delete quiz + question CRUD + bank list with `correctOpt` |
| Types | `frontend/src/api/types.ts` | `AdminQuiz`, `AdminQuestion`, create/edit payloads |
| API | `frontend/src/api/client.ts` | admin service functions |
| Component | `frontend/src/components/ProtectedRoute.tsx` | `requireAdmin` prop |
| Component | `frontend/src/components/TopBar.tsx` | conditional admin link |
| Component | `frontend/src/components/LeaderboardTable.tsx` (new, extracted) | shared pager+table (≥90% rule) |
| Page | `frontend/src/pages/Admin.tsx` (new) | quiz list + actions |
| Page | `frontend/src/pages/AdminQuizForm.tsx` (new) | create/edit |
| Page | `frontend/src/pages/AdminQuestions.tsx` (new) | question bank |
| Page | `frontend/src/pages/AdminLeaderboard.tsx` (new) | read-only leaderboard |
| Route | `frontend/src/App.tsx` | 4 lazy admin routes |
| Tests | `backend/tests/admin-*.test.ts`, frontend colocated | per deliverable |

## Proposed Implementation

### Backend Changes

**B1. require-admin middleware** — `backend/src/middleware/require-admin.ts`
- `requireAdmin(req, res, next)`: if `req.isAdmin !== true` → `403 { error: 'FORBIDDEN', message: 'Admin access required.' }` (envelope style of `auth.ts:30-32`). Runs after `requireAuth`.

**B2. DB helpers** — extend `backend/src/db/quizzes.ts` (module-load prepared statements, named params, exported on the `quizzes` object):
- `insertQuiz(input): QuizRow` (id via `randomUUID()`), `updateQuiz(id, input)`, `deleteQuiz(id)`.
- `listAdminQuizzes(): AdminQuizRow[]` — quizzes + `COUNT` questions (bank size) + `COUNT` participations (attempt count) via LEFT JOINs/subqueries.
- `listQuestions(quizId): AdminQuestionRow[]` — **includes `correct_opt`** (admin-only helper; never wired to contestant routes), ordered by `seq`.
- `insertQuestion(quizId, seq, prompt, optionsJson, correctOpt)`, `updateQuestion(questionId, ...)`, `deleteQuestion(questionId)`.
- `countAttempts(quizId)` — reuse `countLeaderboard` (same COUNT) or alias.

**B3. Admin router** — `backend/src/routes/admin/quizzes.ts`, mounted `app.use('/api/admin/quizzes', adminQuizzesRouter)` in `index.ts`; router uses `requireAuth` + `requireAdmin`.
- `POST /` — validate: title non-empty string, `questionCount` positive int, `endAt > startAt` (ISO strings), `questionCount ≤ countQuestions` (bank is 0 on create → questionCount must be… note: spec allows creating with questionCount > 0 then adding questions; **create does NOT check bank size** since bank is empty — the check applies to edit only; create validates the other rules). 400 `VALIDATION_ERROR` per failure. 201 with the created quiz (contestant `Quiz` shape + `id`).
- `GET /` — 200 array `{ id, title, questionCount, timeLimitSeconds, startAt, endAt, questionBankSize, attemptCount }` (add `description` — harmless enrichment over the spec sample).
- `PUT /:id` — 404 unknown; `409 QUIZ_HAS_ATTEMPTS` if `countAttempts > 0`; same validation as create **plus** `questionCount ≤ questionBankSize` (409 or 400 per spec wording — use `400 VALIDATION_ERROR` with a clear message; document in API.md). 200 with updated quiz.
- `DELETE /:id` — 404 unknown; `db.transaction`: delete participations for the quiz, then delete the quiz (questions cascade). 204.
- `GET /:id/questions` — 404 unknown quiz; 200 array `{ id, text, options, correctOpt }` (map `prompt`→`text`, parse options JSON).
- `POST /:id/questions` — 404 unknown quiz; validate `text` non-empty, `options` array ≥2 non-empty strings, `correctOpt` integer `0..options.length-1`; `seq` = current bank max + 1 (handle UNIQUE(quiz_id,seq)); 201 with the created question.
- `PUT /:id/questions/:questionId` — 404 unknown quiz/question; `409 QUIZ_HAS_ATTEMPTS`; same validation; 200 updated.
- `DELETE /:id/questions/:questionId` — 404; `409 QUIZ_HAS_ATTEMPTS`; 204.
- `GET /:id/leaderboard` — 404 unknown quiz; reuse the public handler logic/queries (extract a shared `buildLeaderboardResponse(quizId, page, pageSize)` or call the same db helpers) — identical shape/pagination/cap.

**B4. API.md sync** — align any drift (PUT questionCount-vs-bank status code, `description` in admin list, `text` vs `prompt` naming) after implementation.

### Frontend Changes

**F1. Foundation (DEL-01)**
- `ProtectedRoute.tsx`: add `requireAdmin?: boolean` — non-admin → `<Navigate to="/" replace />`; keep login redirect for missing token.
- `App.tsx`: 4 lazy routes — `/admin` (Admin), `/admin/quizzes/new` + `/admin/quizzes/:id/edit` (AdminQuizForm), `/admin/quizzes/:id/questions` (AdminQuestions), `/admin/quizzes/:id/leaderboard` (AdminLeaderboard) — all `<ProtectedRoute requireAdmin>`.
- `TopBar.tsx`: `{isAdmin && <Link to="/admin">Admin</Link>}` in the nav cluster.

**F2. Types + services** — `AdminQuiz { id, title, description, questionCount, timeLimitSeconds, startAt, endAt, questionBankSize, attemptCount }` (derive `editable` client-side = `attemptCount === 0`), `AdminQuestion { id, text, options, correctOpt }`, `QuizInput { title, description, questionCount, timeLimitSeconds, startAt, endAt }`, `QuestionInput { text, options, correctOpt }`. Services: `adminFetchQuizzes`, `createQuiz`, `updateQuiz`, `deleteQuiz`, `fetchQuestions`, `createQuestion`, `updateQuestion`, `deleteQuestion`, `adminFetchLeaderboard` — existing one-liner style.

**F3. Admin quiz list page** (`Admin.tsx`) — QuizList fetch pattern (loading/error+Retry/empty); table rows: title, settings, `bank/questionCount` with playable badge (`questionBankSize >= questionCount`), attempts, editable badge; actions: Edit (disabled when attempts > 0, title explains), Delete (confirm via `window.confirm` or inline confirm state), Manage Questions, Leaderboard links; "New quiz" button → `/admin/quizzes/new`.

**F4. Quiz form page** (`AdminQuizForm.tsx`) — controlled inputs, local state, client-side validation mirroring server (title required, positive questionCount, endAt > startAt); create vs edit mode by route; on 409/400 show `role="alert"` message (Login.tsx `toErrorMessage` pattern); success → navigate to `/admin`.

**F5. Question bank page** (`AdminQuestions.tsx`) — header: bank size vs questionCount + playable status ("3/5 questions — not yet playable"); list with correct answer highlighted; add-question form (text, dynamic options list, correctOpt selector); edit inline; delete with confirm; when attempts > 0 all mutations disabled with explanatory note (server still enforces 409).

**F6. Admin leaderboard** — extract `LeaderboardTable.tsx` from `Leaderboard.tsx` (entries `<ul>` + pagination controls + empty/beyond-last states; props `data`, `onPageChange`) — refactor the public page to use it (behavior unchanged, tests stay green modulo import). `AdminLeaderboard.tsx`: thin page fetching `adminFetchLeaderboard` with the standard load/retry pattern, back link to `/admin`.

### Build order

B1 → B2 → B3 → B4 (backend serial — same files); F1 ∥ B1-B3; F2 after B3 contract fixed (can code against API.md in parallel); F3 → F4 → F5 → F6 frontend serial-ish (shared form/nav conventions, distinct pages).

## Edge Cases & Risks

- **Cascade gap**: participations FK has no ON DELETE CASCADE — delete MUST use a transaction (delete participations, then quiz). Test proves questions + participations + leaderboard entries all gone.
- **`correct_opt` leakage**: the ONLY endpoint returning it is admin `GET .../questions` (and PUT/POST responses). Regression test: contestant question-fetch response key set unchanged. Admin responses are behind `requireAdmin` — tested 401/403 matrix.
- **Create-with-questionCount**: spec sample creates with `questionCount: 10` on an empty bank — so bank-size validation applies to **edit** only; create is validated for the other rules. Start-gating (409 INSUFFICIENT_QUESTIONS) protects runtime.
- **seq assignment**: `UNIQUE(quiz_id, seq)` — compute max+1 inside the insert path; deleting a middle question leaves gaps (fine — order by seq).
- **JWT isAdmin staleness**: admin demoted in ADMIN_EMAILS keeps admin until token expiry (2h) — accepted per spec (checked live at login only).
- **Edit form vs 409 race**: attempts landing between load and save → server 409 surfaces in the form.
- **LeaderboardTable extraction**: public Leaderboard tests must stay green after refactor — same change.

## Testing

- **Backend (`tests/admin-auth.test.ts`, `admin-quizzes.test.ts`, `admin-questions.test.ts`, `admin-leaderboard.test.ts`)**: 401/403/admin-pass matrix on `/api/admin/*`; create happy + each 400; list fields (bank size, attempt count); edit 409 with attempts + bank-size rejection; delete cascade (all three tables empty after); questions CRUD happy + validations (empty text, <2 options, bad correctOpt) + 409 with attempts + 404s; admin leaderboard matches public shape/pagination; contestant question-fetch key-set regression (no `correctOpt`).
- **Frontend**: ProtectedRoute requireAdmin redirect; TopBar link visibility by isAdmin; Admin list render/actions/confirm-delete (MSW); form validation + 409 display; Questions page render/add/edit/delete/blocked-state; AdminLeaderboard render + pagination (reuse LeaderboardTable tests pattern). Admin tests seed `{ user: { ...TEST_USER, isAdmin: true } }` sessions.
- **Manual**: sign in as admin (ADMIN_EMAILS) → create quiz → add questions → set questionCount → verify contestant can start; attempt it → verify edit blocked, delete cascades.

## Acceptance Criteria

- [ ] `/api/admin/*`: 401 no token, 403 non-admin, passes with admin JWT — test matrix.
- [ ] Admin can create a quiz; it appears in admin + contestant lists.
- [ ] Admin list shows settings, bank size, attempts, editable state.
- [ ] Edit blocked (409) once attempts exist; delete always works and cascades quiz/questions/participations atomically.
- [ ] `questionCount > bank` rejected on edit (400) with clear message.
- [ ] Question CRUD works; `correctOpt` visible only via admin endpoints; contestant endpoints never expose it (regression-tested).
- [ ] Malformed questions → 400; edit/delete after attempts → 409.
- [ ] Bank ≥ questionCount ⇒ startable; below ⇒ start rejected (existing 409).
- [ ] Admin leaderboard read-only, same shape as public; no mutation endpoints exist.
- [ ] Non-admins: no admin links, `/admin` redirects, 403 from admin API.
- [ ] Both suites, typecheck, lint green.

## Open Questions

- PUT questionCount-vs-bank: plan uses `400 VALIDATION_ERROR` (validation-at-save per A-05 wording); API.md will be updated to match. Flag if 409 preferred.

## Out of Scope

- Pagination on admin quiz list, bulk operations, admin user management, leaderboard moderation, changing the participations FK to ON DELETE CASCADE (transaction suffices).
