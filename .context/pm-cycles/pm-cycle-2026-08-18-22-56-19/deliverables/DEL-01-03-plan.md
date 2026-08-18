# Implementation Plan — DEL-01/02/03 (F-08, F-09, F-10)

**Tickets:** `DEL-01-participation-lock-verification.md`, `DEL-02-abandon-restart-verification.md`, `DEL-03-leaderboard-pagination.md`
**Type:** Enhancement (DEL-01/02 — test hardening, no behavior change) + Feature (DEL-03 — pagination UI)
**Title:** Participation-lock & abandon regression tests; leaderboard pagination UI
**Generated:** 2026-08-18

---

## Summary

DEL-01/02: F-08 (single participation lock) and F-09 (abandon & restart) are already implemented — the deliverable is regression coverage proving the invariants via full HTTP cycles (start → submit → assert), not direct DB inserts. DEL-03: the only real gap — `fetchLeaderboard` sends no `page`/`pageSize` and `Leaderboard.tsx` has no navigation controls; add page state + Previous/Next UI on the existing backend contract (no backend changes).

Coverage audit found these concrete gaps: full-cycle 409 (submit-then-start) exists partially (`submit.test.ts:162`) but list-state-after-real-submit, two-starts-different-seeds, start-then-empty-leaderboard, and the QuizList refetch-after-409 path are untested.

## Affected Components

| Layer | File | Why |
|-------|------|-----|
| Test | `backend/tests/quizzes.test.ts` | Full-cycle participated list test |
| Test | `backend/tests/start.test.ts` | Two-starts-different-seeds; abandon leaves no row |
| Test | `backend/tests/leaderboard.test.ts` | Start-without-submit → empty leaderboard |
| Test | `frontend/src/pages/QuizList.test.tsx` | Refetch after 409 start error |
| API | `frontend/src/api/client.ts` | `fetchLeaderboard(quizId, page?, pageSize?)` |
| Page | `frontend/src/pages/Leaderboard.tsx` | Page state + pagination controls |
| Test | `frontend/src/pages/Leaderboard.test.tsx` | Pagination interaction tests |

## Proposed Implementation

### Backend Changes (tests only)

**B1. Full-cycle participation lock (DEL-01)** — new tests in `backend/tests/quizzes.test.ts` (and reuse in `start.test.ts` if fixture placement is better there):
- Full cycle: `start` → fetch Q1 → `submit` (mixed answers) → `GET /api/quizzes` asserts that quiz `participated: true`, `canStart: false`, `userScore` equals the submit response's `correctCount`. (Current test at `quizzes.test.ts:128-139` pre-inserts the row via `insertParticipationStmt` — keep it, add the real-cycle variant.)
- Full cycle 409: after the cycle above, `POST start` again → 409 `ALREADY_PARTICIPATED` with the standard envelope (complements `submit.test.ts:162`).
- 409-vs-window order: participated user, quiz outside active window → assert the status the route returns today (guard order is window first per `quizzes.ts` start handler; expect 403 — document actual behavior in the test name, e.g. `should_return_403_when_window_closed_even_if_participated`).
- Exhaustive key checks: no `correct_opt`/answer leakage in list or start responses.

**B2. Abandon & restart invariants (DEL-02)** — new tests in `backend/tests/start.test.ts` + `leaderboard.test.ts`:
- Start → fetch two questions → never submit → `GET /api/quizzes` still `participated: false` / `canStart: true`; direct query shows no `participations` row (extends `start.test.ts:91-115`).
- Start → fetch → start again → both 200, seeds differ (assert inequality; randomness left uncontrolled per the deliverable's note).
- Two consecutive starts with no submit → both allowed, no 409.
- Start + fetch (abandoned) → `GET /api/quizzes/:id/leaderboard` returns empty `entries`/`total: 0` for that user (combine a real start call with the empty-board check missing from `leaderboard.test.ts`).

### Frontend Changes

**F1. Refetch-after-409 test (DEL-01)** — `frontend/src/pages/QuizList.test.tsx`:
- MSW: `GET /api/quizzes` returns a startable quiz (count 1); `POST /api/quizzes/:id/start` returns 409 `ALREADY_PARTICIPATED`; then `GET /api/quizzes` handler switches to `participated: true` / `canStart: false` on subsequent calls. Assert: alert surfaces, list re-fetches, Start now disabled with score label. Covers `handleStartError → load()` (`QuizList.tsx:35-38`).

**F2. Pagination (DEL-03)** — `frontend/src/api/client.ts` + `frontend/src/pages/Leaderboard.tsx`:
- `fetchLeaderboard(quizId: string, page = 1, pageSize = LEADERBOARD_PAGE_SIZE = 20): Promise<LeaderboardData>` — send `page`/`pageSize` query params (constant, not magic number). `LeaderboardData` already carries `page/pageSize/total` (`api/types.ts:35-41`) — no type changes.
- `Leaderboard.tsx`: add `page` state (default 1, local state — path carries the quiz id); add `page` to `load`'s deps (`Leaderboard.tsx:19-30`). Loading/error+Retry retry the **current** page. Controls inside the entries `<section>` after the `<ul>` (after `:101`): Previous / Next buttons, "Page X of Y · N entries" indicator (`totalPages = Math.max(1, Math.ceil(total / pageSize))`); Previous disabled on page 1; Next disabled when `page * pageSize >= total`. Rank numbers rendered as-is from the server (continuity server-computed).
- Edge: empty page beyond last (data shrank) → empty state with a "Back to page 1" affordance (reset page to 1).
- Button styling per existing conventions (`rounded-md bg-brand-500 ... disabled:bg-slate-300` + dark variants).

**F3. Pagination tests** — `frontend/src/pages/Leaderboard.test.tsx`:
- Fixture with `total > pageSize` (e.g. total 25, pageSize 20). First page: entries render, Previous disabled. Next → second request captured with `page=2`, continued ranks (21, 22…), Next disabled on last page, Previous returns to page 1.
- Error on page change → alert + Retry retries page 2, stays on page 2.
- Empty-page-beyond-last → back-to-page-1 control works.

## Edge Cases & Risks

- Guard-order test (B1) documents current behavior (403 window-before-participation) — if it fails, that's a genuine finding to surface, not to code around.
- Seed-inequality test is probabilistic in principle — 10-hex seed collision chance is negligible; acceptable.
- Pagination state is local — a refresh returns to page 1 (acceptable per deliverable; shareable state satisfied by quiz id in path).
- No backend changes — contract risk zero.

## Testing

All work IS tests except F2. Verify both suites + typecheck + lint green after each task. Manual: finish a quiz → list shows score + disabled Start; abandon mid-quiz → still startable; leaderboard with >20 entries browses pages.

## Acceptance Criteria

- [ ] Full-cycle tests: submit → list `participated/canStart:false/userScore`; second start 409; no answer leakage.
- [ ] Abandon tests: no participation row/list flag after start-without-submit; restart yields different seed; empty leaderboard after abandoned attempt.
- [ ] QuizList refetches after a 409 start error (test-proven).
- [ ] Leaderboard paginates: Previous/Next work, boundaries disable, ranks continue, retry retries current page.
- [ ] No API/schema changes; both suites, typecheck, lint green.

## Out of Scope

- Backend leaderboard changes (already complete), admin leaderboard (A-09), quiz-list UX beyond existing behavior.
