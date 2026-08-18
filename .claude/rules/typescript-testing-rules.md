# TypeScript Testing Rules (Vitest)

## Overview

Vitest for both backend and frontend. Backend: HTTP-level route tests with `supertest`. Frontend: `@testing-library/react` (jsdom) with MSW (`msw`) mocking API responses. JWT tokens generated per test via `jsonwebtoken`.

## Test Organization

- Backend: tests co-located in `backend/tests/` (or alongside `src/` per repo convention).
- Frontend: co-located `*.test.ts(x)` next to the source file (`QuestionDisplay.test.tsx`).
- One behavior per test. Names: `should_<behavior>_when_<condition>` or `returnsX_whenY`. Pick one and stay consistent within the file.
- AAA layout: Arrange, Act, Assert. Separate visually with blank lines.
- Deterministic data only — fixed fixtures, no uncontrolled randomness.

## Backend (Vitest + supertest)

- Spin up the Express app per suite; use `supertest` against the app instance (import the app, not a live server, when possible).
- Auth'd route tests: sign a JWT with `jsonwebtoken` (`JWT_SECRET`) and send `Authorization: Bearer <token>`.
- Mock the DB at the `pg` boundary when testing route logic (stub `query`/`getClient`) unless the test is a real integration test.
- Test happy paths + error paths (401/403/404/409) + edge cases (deadline passed, timed-out question, sequential-access violation).

```ts
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../src/index'

const token = jwt.sign({ userId: 'u1' }, process.env.JWT_SECRET!)

describe('quiz status', () => {
  it('returns current progress when authenticated', async () => {
    const res = await request(app)
      .get('/api/quiz/status')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})
```

## Frontend (Vitest + Testing Library)

- Render with `@testing-library/react`; user interactions via `@testing-library/user-event`.
- Mock API calls with MSW (`server.use(...)` / handlers) — never hit real network.
- Mock `GoogleOAuthProvider`/auth context as needed.
- Assert on accessible queries (`getByRole`, `getByText`) — not implementation details.
- Test happy paths + error/loading/empty states.

```ts
import { render, screen } from '@testing-library/react'
import { QuestionDisplay } from './QuestionDisplay'

describe('QuestionDisplay', () => {
  it('shows the question text', () => {
    render(<QuestionDisplay question={fixture} />)
    expect(screen.getByText('What year was the company founded?')).toBeInTheDocument()
  })
})
```

## Assertions

- Use Vitest's `expect` + Jest-DOM matchers (`toBeInTheDocument`, `toBeDisabled`, etc.).
- One logical assertion per test (multiple related assertions on the same subject are fine).
- Assert on outcomes, not implementation calls.

## Coverage

- Business logic >80%, components >70%.
- Cover error cases alongside happy paths.

## Running

```bash
cd backend && npm test          # backend vitest run
cd frontend && npm test         # frontend vitest run
```

## Parallelism and Speed

- Tests must be independent — no shared mutable state, no test ordering assumptions.
- Keep unit/component tests fast (<1s each).

## Avoid

- `vi.useRealTimers()` surprises — be explicit about fake timers for timer/countdown tests (this project has a per-question countdown).
- Random data without a fixed seed.
- Catching and swallowing in tests to "make them pass".
- Commenting out failing tests instead of fixing them.
- `console.log` for debug.