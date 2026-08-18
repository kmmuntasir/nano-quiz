# DEL-03 · Feature · Leaderboard pagination UI & page navigation

> **Source:** [`deliverables.md`](../deliverables.md) (DEL-03)
> **Original issue(s):** "F-10 — Leaderboard view" (docs/features.md)

## Problem
F-10 requires a paginated leaderboard the participant can browse. The backend (`backend/src/routes/leaderboard.ts`, `GET /api/quizzes/:id/leaderboard?page=&pageSize=`) already returns `{ quizId, page, pageSize, total, entries: [{ rank, name, score, durationMs }] }` ordered score DESC / duration ASC, with defaults 1/20 and a 100 cap. The frontend `Leaderboard.tsx` page, however, always renders page 1 with no pagination controls — `fetchLeaderboard` (`frontend/src/api/client.ts`) sends no `page`/`pageSize` params. F-10's "working page navigation" acceptance criterion is unmet.

## Solution (end-to-end)

**API client (`frontend/src/api/client.ts`):**
- Extend `fetchLeaderboard(quizId, page?, pageSize?)` to send `page` and `pageSize` query params and return the full typed envelope (including `total`, `page`, `pageSize`) — matching the existing backend contract exactly, no backend changes.

**Leaderboard page (`frontend/src/pages/Leaderboard.tsx`):**
- Local `page` state (URL search param optional — keep simple local state; shareable-state convention satisfied by quiz id in the path).
- Default page 1, page size 20 (matches server default).
- Pagination controls below the entries list: Previous / Next buttons, current page indicator, and total-entry context (e.g. "Page 2 of 5 · 93 entries"). Previous disabled on page 1; Next disabled when `page * pageSize >= total`.
- Loading state while fetching a page (existing loader pattern); error state with retry (existing pattern) that retries the current page, not page 1.
- Empty page edge case (e.g. page beyond last after data changes): show empty state with a way back to page 1.
- Rank numbers continue correctly across pages (server computes `rank = offset + index + 1` — render as-is).
- Ordering (score DESC, duration ASC) and columns (rank, name, score, duration) are already correct — no change.

**Tests:**
- Frontend (MSW): first page renders entries + disabled Previous; Next fetches page 2 and renders continued ranks; Next disabled on last page; error on page change keeps the current page and offers retry.
- Backend: existing endpoint pagination tests already cover page/pageSize/400/404/cap — add only a gap if audit shows one (e.g. rank continuity across pages).

## Acceptance criteria
- Leaderboard lists ranked entries with name, score, and duration (already true; preserved).
- Ordering is score descending, then duration ascending (server-side; preserved).
- Large leaderboards paginate with working Previous/Next page navigation; controls disable correctly at boundaries and ranks continue across pages.
- Leaderboard remains accessible from the quiz result screen (existing Completion link, preserved).
- Frontend test suite green with new pagination tests; no backend changes required.

## Dependencies
None (backend endpoint already shipped in F-07).
