# DEL-01 · Feature · Admin auth foundation & gated admin UI shell

> **Source:** [`deliverables.md`](../deliverables.md) (DEL-01)
> **Original issue(s):** A-01 — Admin identity & gated admin UI (remainder: identity already exists)

## Problem
Admins are identified at login (`ADMIN_EMAILS` → `isAdmin` in the JWT, exposed via `AuthContext`), but nothing consumes it: there is no `require-admin` middleware in `backend/src/middleware/` (only `auth.ts`, which sets `req.isAdmin` but never gates on it), no `routes/admin/` mount, and the frontend has no Admin page, no admin routes, and no admin links. `ProtectedRoute` only checks for a token. Any `/api/admin/*` endpoint built next would have no security boundary, and admins have nowhere to manage content.

## Solution (end-to-end)
- **Backend — `middleware/require-admin.ts`**: runs after `auth.ts`; reads `req.isAdmin`; returns `403` with the project error envelope (`{ error, message }`) when absent/invalid. This middleware — not UI hiding — is the security boundary for everything under `/api/admin/*`.
- **Backend — route mount**: create `routes/admin/quizzes.ts` (empty router for now, populated by DEL-02..04) mounted at `/api/admin` in `src/index.ts`, gated by `auth` + `require-admin`.
- **Backend — tests**: supertest suite proving `/api/admin/*` returns 401 without a token, 403 with a non-admin JWT, and passes through with an admin JWT (`{ userId, isAdmin: true }` signed with `JWT_SECRET`).
- **Frontend — `ProtectedRoute` `requireAdmin` prop**: non-admins are redirected away from `/admin/*` (to quiz list); unauthenticated users still go to `/login`.
- **Frontend — Admin shell**: lazy-loaded `/admin` route (React.lazy + Suspense + ErrorBoundary per App.tsx convention) rendering a minimal `Admin` page placeholder listing the quizzes link outlet for DEL-02..04.
- **Frontend — nav**: admin link (e.g. in `TopBar`) rendered only when `AuthContext.isAdmin` is true; zero admin markup for regular users.

## Acceptance criteria
- Request to any `/api/admin/*` path without a JWT → 401; with a non-admin JWT → 403; with an admin JWT → routed (not 401/403).
- Non-admin users see no admin links anywhere; navigating directly to `/admin` redirects them away.
- Admin users see the admin link and reach the admin shell page.
- Backend and frontend test suites cover the 401/403/admin-pass matrix and the route-guard behavior.

## Dependencies
None (foundational).
