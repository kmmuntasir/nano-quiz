# Task Breakdown — DEL-01/02/03 (F-08 lock tests, F-09 abandon tests, F-10 pagination)

**Plan:** `DEL-01-03-plan.md`
**Generated:** 2026-08-18

## Parallelization Strategy

Four tasks, all file-disjoint — single parallel batch. No cross-dependencies (tests verify existing behavior; pagination is self-contained frontend).

```
T1 backend lock tests ─┐
T2 backend abandon tests ─┤── all parallel, merge any order
T3 QuizList 409-refetch test ─┤
T4 leaderboard pagination ─┘
```

| # | Batch | Target File(s) | Dependencies | Can Parallel With |
|---|-------|----------------|--------------|-------------------|
| T1 | 1 | `backend/tests/quizzes.test.ts` (+ possibly `start.test.ts`) | — | T2, T3, T4 |
| T2 | 1 | `backend/tests/start.test.ts`, `backend/tests/leaderboard.test.ts` | — | T1, T3, T4 |
| T3 | 1 | `frontend/src/pages/QuizList.test.tsx` | — | T1, T2, T4 |
| T4 | 1 | `frontend/src/api/client.ts`, `frontend/src/pages/Leaderboard.tsx`, `frontend/src/pages/Leaderboard.test.tsx` | — | T1, T2, T3 |

**Merge rules:** each merge leaves both suites + typecheck + lint green. No App.tsx or shared-file conflicts.

**Tracks:** Backend: T1 → T2. Frontend: T3 ∥ T4.

---

### T1 — Full-cycle participation lock tests (F-08)

**Description**

Add full-HTTP-cycle regression tests (no direct DB participation inserts — real start → submit flow):

- In `backend/tests/quizzes.test.ts` (current pre-inserted test at `:128-139` stays): full cycle — `POST start` → fetch Q1 → `POST submit` with mixed answers → `GET /api/quizzes` asserts `participated: true`, `canStart: false`, `userScore` === submit response `correctCount`.
- Second `POST start` after the cycle → 409 `ALREADY_PARTICIPATED` + standard envelope (complements `submit.test.ts:162`).
- Guard-order test: participated user + quiz outside active window → assert the route's actual current behavior (window check precedes participation in the start handler → expect 403); name the test for what it asserts, e.g. `should_return_403_when_window_closed_even_if_participated`.
- Exhaustive key checks on list/start responses — no `correct_opt` or answer data.

Conventions: existing fixtures/helpers in `quizzes.test.ts`/`start.test.ts` (`iso()`, `insertQuiz`, JWT `'test-jwt-secret'`, `should_<behavior>_when_<condition>`).

**Acceptance Criteria**

- [ ] Full-cycle list-state, full-cycle 409, guard-order test all pass.
- [ ] No direct `insertParticipationStmt` in the new tests.
- [ ] `cd backend && npm test && npm run typecheck && npm run lint` pass.

**Dependencies:** None.

### T2 — Abandon & restart invariant tests (F-09)

**Description**

- In `backend/tests/start.test.ts`: start → fetch two questions → never submit → `GET /api/quizzes` still `participated: false` / `canStart: true` and no `participations` row (extends `:91-115`); start → fetch → start again → both 200, seeds differ (assert inequality); two consecutive starts no submit → both allowed, no 409.
- In `backend/tests/leaderboard.test.ts`: start + fetch (abandoned) → `GET /api/quizzes/:id/leaderboard` shows no entry for that user (`total: 0` or absent from entries).

Same conventions as T1.

**Acceptance Criteria**

- [ ] No-record-on-abandon, different-seed restart, double-start, empty-leaderboard-after-abandon all test-proven.
- [ ] `cd backend && npm test && npm run typecheck && npm run lint` pass.

**Dependencies:** None.

### T3 — QuizList refetch-after-409 test (F-08)

**Description**

`frontend/src/pages/QuizList.test.tsx`: MSW sequence — `GET /api/quizzes` returns a startable quiz; `POST /api/quizzes/:id/start` → 409 `ALREADY_PARTICIPATED`; subsequent `GET /api/quizzes` returns the quiz `participated: true` / `canStart: false` / `userScore` set. Assert: error alert surfaces, list refetched (StartQuizButton now disabled with score label). Covers `handleStartError → load()` (`QuizPlay`-sibling path `QuizList.tsx:35-38`).

**Acceptance Criteria**

- [ ] Test proves the 409 → refetch → disabled-with-score transition.
- [ ] `cd frontend && npm test && npm run typecheck && npm run lint` pass.

**Dependencies:** None.

### T4 — Leaderboard pagination UI (F-10)

**Description**

- `frontend/src/api/client.ts` (`fetchLeaderboard` at `:118-121`): add `page = 1, pageSize = LEADERBOARD_PAGE_SIZE = 20` params, send as query params. Types unchanged (`LeaderboardData` already carries page/pageSize/total).
- `frontend/src/pages/Leaderboard.tsx`: `page` state (default 1) added to `load` deps (`:19-30`); loading/error+Retry retry the **current** page; controls after the entries `<ul>` (after `:101`): Previous/Next buttons + "Page X of Y · N entries" (`totalPages = max(1, ceil(total/pageSize))`); Previous disabled on page 1, Next disabled when `page * pageSize >= total`; empty-page-beyond-last → empty state with back-to-page-1; ranks rendered as server-provided. Tailwind button conventions + dark variants; no magic numbers.
- `frontend/src/pages/Leaderboard.test.tsx`: fixture `total: 25, pageSize: 20` — first page renders + Previous disabled; Next issues request with `page=2` and renders continued ranks (21+), Next disabled on last page; Previous returns to page 1; error on page change → alert + Retry retries page 2 (stays); beyond-last empty → back-to-page-1 works.

**Acceptance Criteria**

- [ ] Working Previous/Next with correct boundary disabling; ranks continue across pages.
- [ ] Retry retries current page; beyond-last recovery works.
- [ ] `cd frontend && npm test && npm run typecheck && npm run lint` pass.

**Dependencies:** None.
