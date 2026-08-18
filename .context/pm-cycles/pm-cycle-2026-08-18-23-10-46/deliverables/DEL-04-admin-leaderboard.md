# DEL-04 · Feature · Admin leaderboard (read-only)

> **Source:** [`deliverables.md`](../deliverables.md) (DEL-03)
> **Original issue(s):** A-09 — Admin leaderboard (read-only)

## Problem
The public leaderboard endpoint exists (`GET /api/quizzes/:id/leaderboard`, paginated, cap 100, per analyst), but admins have no view from the admin area and no admin-scoped endpoint per the API spec.

## Solution (end-to-end)
- **`GET /api/admin/quizzes/:id/leaderboard`** — behind `require-admin`; same response shape, pagination (`page`/`pageSize`, cap 100), and ordering as the public endpoint (reuse the same db queries/ordering logic rather than duplicating). `404` unknown quiz. No mutation endpoints exist for leaderboards anywhere.
- **Frontend — admin leaderboard view** (`/admin/quizzes/:id/leaderboard`): paginated table (rank, name, score, duration) reusing/composing the existing Leaderboard presentation components where ≥90% similar; read-only by construction; linked from the admin quiz list (DEL-02).
- **Tests**: backend supertest — auth matrix (401/403), pagination behavior matches public endpoint; frontend — rendering + pagination via MSW.

## Acceptance criteria
- Admin can open a quiz's leaderboard from the admin area; data matches the public leaderboard for the same quiz.
- Non-admins get 403 from the admin endpoint and cannot reach the admin route.
- No admin endpoint or UI control can modify leaderboard data.

## Dependencies
DEL-01 (require-admin + admin shell); linked from DEL-02's quiz list but independently shippable.
