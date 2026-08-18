# Task Breakdown — DEL-01..04 (A-01..A-09 admin features)

**Plan:** `DEL-01-04-plan.md`
**Generated:** 2026-08-18

## Parallelization Strategy

Batch 1 (T1–T3): parallel, disjoint files. Batch 2 (T4–T7): backend serial track (shared `routes/admin/quizzes.ts` + `db/quizzes.ts`). Batch 3 (T8–T11): frontend serial track (all edit `App.tsx`; pages navigate from the Admin list).

```
Batch 1:  T1 (require-admin mw + router stub)   T2 (ProtectedRoute requireAdmin + TopBar link)   T3 (types + services)
                 │                                        │                                            │
Batch 2:  T4 (db helpers) → T5 (quiz CRUD routes) → T6 (questions + admin leaderboard routes) → T7 (API.md sync)
                 │                  │                     │
Batch 3:             T8 (Admin list page) → T9 (quiz form) → T10 (question bank) → T11 (LeaderboardTable + admin leaderboard)
```

**Merge rules:** every merge leaves both suites + typecheck + lint green. Backend T5/T6 before the frontend pages calling them merge (coding against API.md is fine; merging is not). T8→T9→T10→T11 strictly serial. T11's extraction + public-page refactor land green together.

| # | Batch | Target File(s) | Dependencies | Can Parallel With |
|---|-------|----------------|--------------|-------------------|
| T1 | 1 | `backend/src/middleware/require-admin.ts` (new), `backend/src/routes/admin/quizzes.ts` (stub), `backend/src/index.ts`, `backend/tests/admin-auth.test.ts` | — | T2, T3 |
| T2 | 1 | `frontend/src/components/ProtectedRoute.tsx`, `TopBar.tsx` (+ tests) | — | T1, T3 |
| T3 | 1 | `frontend/src/api/types.ts`, `frontend/src/api/client.ts` | — | T1, T2 |
| T4 | 2 | `backend/src/db/quizzes.ts` | — (after T1 contextually) | T2, T3 |
| T5 | 2 | `backend/src/routes/admin/quizzes.ts`, `backend/tests/admin-quizzes.test.ts` | T1, T4 | T2, T3 |
| T6 | 2 | `backend/src/routes/admin/quizzes.ts`, `backend/tests/admin-questions.test.ts`, `admin-leaderboard.test.ts` | T1, T4, T5 | T3 |
| T7 | 2 | `docs/api-docs/API.md` | T5, T6 | T8 |
| T8 | 3 | `frontend/src/pages/Admin.tsx` (new), `frontend/src/App.tsx`, `Admin.test.tsx` | T2, T3, T5 | T7 |
| T9 | 3 | `frontend/src/pages/AdminQuizForm.tsx` (new), `App.tsx`, `AdminQuizForm.test.tsx` | T8, T3 | T6, T7 |
| T10 | 3 | `frontend/src/pages/AdminQuestions.tsx` (new), `App.tsx`, `AdminQuestions.test.tsx` | T8, T3, T6 | T7 |
| T11 | 3 | `frontend/src/components/LeaderboardTable.tsx` (new), `pages/Leaderboard.tsx`, `pages/AdminLeaderboard.tsx` (new), `App.tsx`, tests | T8, T3 | — |

**Tracks:** Backend: T1 → T4 → T5 → T6 → T7. Frontend: T2 ∥ T3 → (wait for backend contract merges) → T8 → T9 → T10 → T11.

---

## Batch 1

### T1 — require-admin middleware + admin router stub + auth matrix

**Description**

- `backend/src/middleware/require-admin.ts`: `requireAdmin` — after `requireAuth` (sets `req.isAdmin` at `middleware/auth.ts:68-69`), reject `403 { error: 'FORBIDDEN', message: 'Admin access required.' }` when `req.isAdmin !== true`; envelope style of `sendUnauthorized` (`auth.ts:30-32`).
- `backend/src/routes/admin/quizzes.ts`: stub router — `requireAuth` → `requireAdmin`, single probe `GET /healthz` → `{ ok: true }`.
- Mount in `backend/src/index.ts`: `app.use('/api/admin/quizzes', adminQuizzesRouter)` (`.js` import suffix per convention).
- Tests `backend/tests/admin-quizzes`… `backend/tests/admin-auth.test.ts`: 401 no token / 401 malformed / 403 `isAdmin: false` / 200 `isAdmin: true` on the probe route. JWT per convention (`'test-jwt-secret'`).

**Acceptance Criteria**

- [ ] 401/403/200 matrix green; middleware envelope matches project style.
- [ ] `npm test`, `typecheck`, `lint` pass in `backend/`.

**Dependencies:** None.

### T2 — ProtectedRoute requireAdmin + TopBar admin link

**Description**

- `frontend/src/components/ProtectedRoute.tsx`: add `requireAdmin?: boolean`; non-admin → `<Navigate to="/" replace />`; missing-token → login redirect unchanged (`:13-15`).
- `frontend/src/components/TopBar.tsx`: `{isAdmin && <Link to="/admin">Admin</Link>}` in the nav cluster (styling mirrors the Sign out button `:52`); zero admin markup for non-admins.
- Tests (MemoryRouter-wrapped): ProtectedRoute matrix (admin+requireAdmin renders, non-admin+requireAdmin redirects, missing token → login, non-admin without requireAdmin renders — regression); TopBar link visible only for isAdmin (seed `{ user: { ...TEST_USER, isAdmin: true } }`).

**Acceptance Criteria**

- [ ] Guard + link behave per matrix; co-located tests green.
- [ ] `npm test`, `typecheck`, `lint` pass in `frontend/`.

**Dependencies:** None.

### T3 — Admin types + service functions

**Description**

- `frontend/src/api/types.ts`: `AdminQuiz { id, title, description: string | null, questionCount, timeLimitSeconds, startAt, endAt, questionBankSize, attemptCount }`; `AdminQuestion { id, text, options: string[], correctOpt }`; `QuizInput`; `QuestionInput`. `editable` derived client-side (`attemptCount === 0`), not a server field.
- `frontend/src/api/client.ts` — nine services, one-liner style (`fetchQuizzes` at `:101-104`): `adminFetchQuizzes`, `createQuiz`, `updateQuiz`, `deleteQuiz`, `fetchQuestions`, `createQuestion`, `updateQuestion`, `deleteQuestion`, `adminFetchLeaderboard(quizId, page = 1, pageSize = LEADERBOARD_PAGE_SIZE)` (shares the existing constant). Reuse `apiClient`.
- Typecheck + lint suffice (no colocated service-test convention); behavior covered by page tests later.

**Acceptance Criteria**

- [ ] Types + nine services exported; no `any`; nothing outside the two files touched.
- [ ] `npm run typecheck`, `npm run lint` green.

**Dependencies:** None.

---

## Batch 2 (backend serial)

### T4 — Admin DB helpers

**Description**

Extend `backend/src/db/quizzes.ts` (module-load prepared statements, named params, exported on `quizzes`):

- `insertQuiz(input)` (id `randomUUID()`), `updateQuiz(id, input)`, `deleteQuiz(id)` (questions cascade via `schema.ts:26`), `deleteParticipationsByQuiz(quizId)` — explicit, for the delete transaction (FK lacks ON DELETE CASCADE, `schema.ts:34-41`).
- `listAdminQuizzes()` — quizzes + `questionBankSize` + `attemptCount` (COUNT subqueries/LEFT JOINs) + `description`.
- `listQuestions(quizId)` — **includes `correct_opt`**, ordered by `seq` (admin-only helper, never imported by contestant routes), `findQuestionById(quizId, questionId)`.
- `insertQuestion(quizId, seq, prompt, optionsJson, correctOpt)`, `updateQuestion`, `deleteQuestion`; `countAttempts(quizId)` (alias/reuse of the leaderboard count).

`prompt`↔`text` mapping stays in routes (existing pattern).

**Acceptance Criteria**

- [ ] All helpers exported; prepared statements only; `listQuestions` seq-ordered with `correct_opt`.
- [ ] `typecheck`, `lint`, existing tests green.

**Dependencies:** None (T1 merged first for context).

### T5 — Admin quiz CRUD routes + tests

**Description**

`backend/src/routes/admin/quizzes.ts` (replace the stub's probe; keep guards `requireAuth` → `requireAdmin`):

- `POST /` — validate title non-empty, `questionCount` positive int, `endAt > startAt` (ISO). **No bank-size check on create** (bank empty). 400 `VALIDATION_ERROR` each. 201 with created quiz.
- `GET /` — 200 array with `questionBankSize` + `attemptCount` + `description`.
- `PUT /:id` — 404 unknown; 409 `QUIZ_HAS_ATTEMPTS` when attempts > 0; create validations **plus** `questionCount ≤ questionBankSize` → 400; 200 updated.
- `DELETE /:id` — 404; `db.transaction` → `deleteParticipationsByQuiz` then `deleteQuiz`; 204.

Tests `backend/tests/admin-quizzes.test.ts`: 401/403 matrix; create happy + each 400; list fields; edit 409 + bank-size 400 + 404; delete cascade (quiz + questions + participations all gone after).

**Acceptance Criteria**

- [ ] Endpoint matrix green; delete atomic; 403 on non-admin everywhere.
- [ ] `npm test`, `typecheck`, `lint` pass in `backend/`.

**Dependencies:** T1, T4.

### T6 — Admin question routes + admin leaderboard + tests

**Description**

Same router file:

- `GET /:id/questions` — 404 quiz; 200 `[{ id, text, options, correctOpt }]`.
- `POST /:id/questions` — 404 quiz; validate text non-empty, options ≥2 non-empty strings, `correctOpt` int `0..len-1`; `seq` = max+1; 201.
- `PUT /:id/questions/:questionId` — 404 quiz/question; 409 attempts; same validation; 200.
- `DELETE /:id/questions/:questionId` — 404; 409 attempts; 204.
- `GET /:id/leaderboard` — 404 quiz; reuse the public leaderboard query/response logic (extract shared helper or call same db helpers) — identical shape/pagination/cap. Read-only.

Tests `backend/tests/admin-questions.test.ts` (401/403 matrix, CRUD happy, each 400, 409 after attempts, 404s) + `backend/tests/admin-leaderboard.test.ts` (matches public shape, 404, 403). **Regression:** contestant question-fetch key set contains no `correctOpt`/`correct_opt`.

**Acceptance Criteria**

- [ ] Question CRUD + validations green; `correctOpt` only via admin endpoints (regression-proven).
- [ ] Admin leaderboard identical shape to public.
- [ ] `npm test`, `typecheck`, `lint` pass in `backend/`.

**Dependencies:** T1, T4, T5.

### T7 — API.md admin sync

**Description**

Docs-only after implementation: PUT bank-size → 400; `description` in admin list; `text`/`correctOpt` naming in examples; delete cascade semantics (204, participations explicit); seq assignment max+1 (gaps OK); create-doesn't-check-bank note; admin leaderboard documented. Doc follows code.

**Acceptance Criteria**

- [ ] Admin section matches every implemented status/field exactly.

**Dependencies:** T5, T6.

---

## Batch 3 (frontend serial)

### T8 — Admin quiz list page

**Description**

New `frontend/src/pages/Admin.tsx` + lazy `/admin` route in `App.tsx` behind `<ProtectedRoute requireAdmin>`. Fetch via `adminFetchQuizzes()` with the `QuizList.tsx:16-44` pattern (loading/error+Retry/empty). Table: title, settings, `questionBankSize/questionCount` + playable badge, attempts, editable badge. Row actions: Edit → `/admin/quizzes/:id/edit` (disabled when `attemptCount > 0` with explanatory title), Delete (confirm → `deleteQuiz` → refresh), Manage Questions, Leaderboard links. Header "New quiz" → `/admin/quizzes/new`. TopBar included.

Tests `Admin.test.tsx` (admin-seeded session + MSW): render, actions, disabled-edit, delete-confirm refresh, error/empty.

**Acceptance Criteria**

- [ ] List + actions + states behave per spec; non-admin redirect covered.
- [ ] `npm test`, `typecheck`, `lint` pass.

**Dependencies:** T2, T3, T5.

### T9 — Quiz create/edit form

**Description**

New `frontend/src/pages/AdminQuizForm.tsx` + routes `/admin/quizzes/new` and `/admin/quizzes/:id/edit` (lazy, requireAdmin). Mode from route; edit prefills (from `adminFetchQuizzes` list). Controlled inputs; client validation mirrors server (title, positive questionCount, endAt > startAt); `role="alert"` on 400/409 (`toErrorMessage` pattern from Login.tsx); navigate `/admin` on success. No form libraries.

Tests: create happy, edit happy, validation blocks, 409 alert.

**Acceptance Criteria**

- [ ] Both modes work; validation + server errors surfaced; tests green.

**Dependencies:** T8, T3.

### T10 — Question bank page

**Description**

New `frontend/src/pages/AdminQuestions.tsx` at `/admin/quizzes/:id/questions`. Header: `bank/questionCount` + playable status ("3/5 questions — not yet playable"). List via `fetchQuestions`, correct answer highlighted. Add form: text, dynamic options (add/remove, min 2), correctOpt selector bound to options. Inline edit; delete with confirm. When `attemptCount > 0`: all mutations disabled + explanatory note (server 409 backstop).

Tests: render, add (dynamic options), inline edit, delete-confirm, locked state.

**Acceptance Criteria**

- [ ] Full CRUD + locked state + header status; tests green.

**Dependencies:** T8, T3, T6.

### T11 — LeaderboardTable extraction + admin leaderboard page

**Description**

- Extract `frontend/src/components/LeaderboardTable.tsx` from `pages/Leaderboard.tsx` (entries list + pagination + empty/beyond-last states; props `data`, `onPageChange`). Refactor public page to consume it — behavior unchanged, existing tests stay green (import-only churn). `LeaderboardTable.test.tsx` for the component.
- New `frontend/src/pages/AdminLeaderboard.tsx` at `/admin/quizzes/:id/leaderboard`: `adminFetchLeaderboard` load/retry pattern, renders `LeaderboardTable`, back link to `/admin`. Read-only.

Tests: admin page render + pagination + error/retry via MSW.

**Acceptance Criteria**

- [ ] Extraction lands green; admin leaderboard renders/paginates; back link works.

**Dependencies:** T8, T3.
