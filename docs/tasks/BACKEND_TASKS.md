# Backend Task Breakdown Documentation

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Project Setup](#phase-1-project-setup)
3. [Phase 2: Database](#phase-2-database)
4. [Phase 3: Authentication](#phase-3-authentication)
5. [Phase 4: Quiz API](#phase-4-quiz-api)
6. [Phase 5: Leaderboard API](#phase-5-leaderboard-api)
7. [Phase 6: Security](#phase-6-security)
8. [Phase 7: Testing](#phase-7-testing)
9. [Dependencies Matrix](#dependencies-matrix)

---

## Overview

This document outlines the complete task breakdown for building the OpenQuiz backend. The backend is a REST API built with Node.js, Express.js, and TypeScript, interfacing with PostgreSQL via Supabase.

| Attribute | Value |
|-----------|-------|
| **Runtime** | Node.js 18+ |
| **Framework** | Express.js |
| **Language** | TypeScript |
| **Database** | PostgreSQL (Supabase) |
| **Port** | 3000 |

### Phase Summary

| Phase | # Tasks | Description |
|-------|--------|------------|
| 1 | 2 | Project initialization and configuration |
| 2 | 2 | Database connection, schema, and seeding |
| 3 | 2 | Google OAuth and onboarding |
| 4 | 4 | Quiz flow (status, start, question, answer) |
| 5 | 1 | Leaderboard endpoint |
| 6 | 3 | Security middleware |
| 7 | 4 | Testing |

---

## Phase 1: Project Setup

### T1: Initialize Node.js Project with TypeScript

**Description:**

Initialize the backend project with Express.js and TypeScript. Set up the project structure including the initial directory layout, install all required dependencies, and configure TypeScript.

**Dependencies:**

- None

**Acceptance Criteria:**

- [ ] `package.json` exists with all required dependencies
- [ ] `tsconfig.json` is properly configured
- [ ] `npm run dev` starts the server on port 3000
- [ ] Server responds to `GET /health` with 200 OK

**Required Dependencies:**

```json
{
  "dependencies": {
    "express": "^4.x",
    "cors": "^2.x",
    "dotenv": "^16.x",
    "pg": "^8.x",
    "google-auth-library": "^9.x",
    "jsonwebtoken": "^9.x",
    "uuid": "^9.x",
    "morgan": "^1.x"
  },
  "devDependencies": {
    "@types/express": "^4.x",
    "@types/cors": "^2.x",
    "@types/pg": "^8.x",
    "@types/jsonwebtoken": "^9.x",
    "@types/uuid": "^9.x",
    "@types/morgan": "^1.x",
    "typescript": "^5.x",
    "tsx": "^4.x"
  }
}
```

---

### T2: Configure Environment Variables

**Description:**

Create the `.env.example` file documenting all required environment variables. Create a `.env` template that can be copied for local development.

**Dependencies:**

- T1

**Acceptance Criteria:**

- [ ] `.env.example` contains all variables from PRD section 8.1
- [ ] All variables have descriptive comments
- [ ] `.env` file exists with placeholder values

**Environment Variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | Yes | Server port (default: 3000) |
| FRONTEND_URL | Yes | Netlify deployed URL for CORS |
| GOOGLE_CLIENT_ID | Yes | Google OAuth client ID |
| RESTRICT_DOMAIN | No | Domain to restrict (e.g., @exabyting.com) |
| JWT_SECRET | Yes | Secret for signing JWT tokens |
| SUPABASE_DB_URL | Yes | PostgreSQL connection string |
| EVENT_DEADLINE_ISO | Yes | ISO 8601 deadline timestamp |
| TRACK_PER_QUESTION_TIME | No | Record per-question view timestamps (default: false) |

---

## Phase 2: Database

### T3: Set Up PostgreSQL Connection Pool

**Description:**

Implement the database connection pool using the `pg` library. Create a centralized database module that handles query execution, connection pooling, and error handling.

**Dependencies:**

- T2

**Acceptance Criteria:**

- [ ] Database connects to Supabase using `SUPABASE_DB_URL`
- [ ] Can execute raw SQL queries
- [ ] Connection errors are handled gracefully
- [ ] Pool releases connections properly
- [ ] Schema from `docs/data/schema.sql` is applied to create `users`, `questions`, and `user_sessions` tables matching PRD Section 6 exactly
- [ ] Schema includes proper foreign keys, constraints, and indexes

**Implementation Notes:**

```typescript
// src/db/index.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export const getClient = () => pool.connect();
```

**Schema File:**

The canonical schema lives at `docs/data/schema.sql`. Apply it to create all three tables:

```bash
psql $SUPABASE_DB_URL -f docs/data/schema.sql
```

See `docs/data/schema.sql` for the full DDL (tables, constraints, indexes).

---

### T4: Create Seed Script for Loading JSON Questions

**Description:**

Implement the data seeding functionality that reads question JSON files from the `/data` directory and populates the `questions` table.

**Dependencies:**

- T3

**Acceptance Criteria:**

- [ ] Reads `/data/faq_questions.json` with category `faq`
- [ ] Reads `/data/trivia_questions.json` with category `trivia`
- [ ] Inserts all questions into `questions` table
- [ ] `npm run seed` executes successfully
- [ ] Supports idempotent seeding (can re-run without duplicates)

**JSON Schema:**

```json
[
  {
    "question": "What year was the company founded?",
    "options": {
      "A": "2018",
      "B": "2019",
      "C": "2020",
      "D": "2021"
    },
    "correct_option": "B"
  }
]
```

**Database Insert:**

```sql
INSERT INTO questions (category, question_text, opt_a, opt_b, opt_c, opt_d, correct_opt)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (category, question_text) DO NOTHING;
```

---

## Phase 3: Authentication

### T5: Implement Google OAuth Verification

**Description:**

Implement the `/api/auth/google` endpoint that verifies the Google JWT token, creates or retrieves the user, and issues an application JWT.

**Dependencies:**

- T3

**Acceptance Criteria:**

- [ ] Endpoint `POST /api/auth/google` accepts `{ token: "GOOGLE_JWT" }`
- [ ] Verifies token using `google-auth-library`
- [ ] Creates new user if not exists (extracts google_id, email, name)
- [ ] Returns JWT, user object, onboarding status
- [ ] Validates domain if `RESTRICT_DOMAIN` is set
- [ ] Issues JWT with `expiresIn: '2h'` (per PRD Section 9.5 — accommodates quiz duration plus crash/resume buffer)

**Response Schema:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "employee_id": null,
    "has_onboarded": false
  },
  "onboarding_required": true
}
```

---

### T6: Implement Onboard Endpoint

**Description:**

Implement the `/api/auth/onboard` endpoint that saves the user's employee ID during first-time setup.

**Dependencies:**

- T5

**Acceptance Criteria:**

- [ ] Endpoint `POST /api/auth/onboard` accepts `{ employee_id: "EMP123" }`
- [ ] Updates `employee_id` in users table
- [ ] Returns success confirmation
- [ ] Rejects if employee_id is already taken
- [ ] Rejects if user already has an employee_id set (prevents re-onboarding / ID changes)

---

## Phase 4: Quiz API

### T7: Implement Quiz Status Endpoint

**Description:**

Implement the `/api/quiz/status` endpoint that checks the user's current quiz progress.

**Dependencies:**

- T5

**Acceptance Criteria:**

- [ ] Endpoint `GET /api/quiz/status` returns current progress
- [ ] Returns `current_sequence` (1-10) if quiz started
- [ ] Returns `completed: true` if quiz submitted
- [ ] Returns `started: false` if not started
- [ ] Handles resume for disconnected users

**Response Schema:**

Not started:

```json
{
  "started": false,
  "completed": false
}
```

In progress:

```json
{
  "started": true,
  "completed": false,
  "current_sequence": 3,
  "started_at": "2024-01-15T10:00:00Z"
}
```

Completed:

```json
{
  "started": true,
  "completed": true,
  "score": 8,
  "started_at": "2024-01-15T10:00:00Z",
  "completed_at": "2024-01-15T10:05:32Z"
}
```

**Implementation Notes:**

Determine `current_sequence` by finding the first unanswered question:

```sql
SELECT MIN(sequence_order) AS current_sequence
FROM user_sessions
WHERE user_id = $1 AND user_answer IS NULL;
```

- If the result is `NULL` (all 10 answered), the quiz is completed. Set `completed: true` and also update `users.completed_at` as a safety net (normally set by the answer endpoint on Q10). If `users.score IS NULL`, also recalculate the score using the same join query as T10. Return `score`, `started_at`, and `completed_at` in the response so the frontend completion screen can display results on page refresh.
- If the user has no rows in `user_sessions`, return `started: false`.
- If the user has a `started_at` but `current_sequence` is not NULL, return the sequence number for resumption.

---

### T8: Implement Start Quiz Endpoint

**Description:**

Implement the `/api/quiz/start` endpoint that allocates 10 random questions and starts the quiz timer.

**Dependencies:**

- T7

**Acceptance Criteria:**

- [ ] Endpoint `POST /api/quiz/start` allocates questions
- [ ] Selects 6 random questions where `category='faq'`
- [ ] Selects 4 random questions where `category='trivia'`
- [ ] Writes to `user_sessions` with randomized `sequence_order` (1-10)
- [ ] Records `started_at` using PostgreSQL `NOW()`
- [ ] Validates that at least 6 `faq` and 4 `trivia` questions exist in the database; returns `503 Service Unavailable` with a descriptive message if not
- [ ] Rejects with `403 Forbidden` if user has not completed onboarding (`employee_id IS NULL`)
- [ ] Idempotent: aborts if user already has `started_at`, returns existing session data without resetting the timer

**Database Transaction:**

```sql
BEGIN;
UPDATE users SET started_at = NOW() WHERE id = $1 AND started_at IS NULL;
-- Application code MUST check rowCount after UPDATE.
-- If rowCount === 0, user already started → ROLLBACK and return existing session.

WITH selected_faq AS (
  SELECT id FROM questions WHERE category = 'faq' ORDER BY RANDOM() LIMIT 6
),
selected_trivia AS (
  SELECT id FROM questions WHERE category = 'trivia' ORDER BY RANDOM() LIMIT 4
),
all_questions AS (
  SELECT id FROM selected_faq
  UNION ALL
  SELECT id FROM selected_trivia
),
shuffled AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY RANDOM()) AS seq
  FROM all_questions
)
INSERT INTO user_sessions (user_id, question_id, sequence_order)
SELECT $1, id, seq FROM shuffled;

COMMIT;
```

---

### T9: Implement Get Question Endpoint

**Description:**

Implement the `/api/quiz/question/:sequence` endpoint that retrieves a specific question by sequence order.

**Dependencies:**

- T8

**Acceptance Criteria:**

- [ ] Endpoint `GET /api/quiz/question/:sequence` fetches question
- [ ] Parameter `sequence` is between 1-10
- [ ] **Response MUST NOT contain `correct_opt` field**
- [ ] Returns 404 if sequence invalid or not found
- [ ] **Enforces sequential access:** rejects with `403 Forbidden` if the requested sequence is not the user's current first unanswered question. Find current position via `MIN(sequence_order) WHERE user_answer IS NULL`. This prevents both backtracking to answered questions and jumping ahead to future ones.
- [ ] **Per-question timing:** if `TRACK_PER_QUESTION_TIME` env is `true`, sets `viewed_at = NOW()` on first fetch (only when `viewed_at IS NULL`)

**Implementation Notes:**

Sequential access check:

```sql
-- Find the user's current position (first unanswered question)
SELECT MIN(sequence_order) AS current_seq
FROM user_sessions
WHERE user_id = $1 AND user_answer IS NULL;
-- If requested :sequence != current_seq → 403 Forbidden
```

Per-question timing (gated by `TRACK_PER_QUESTION_TIME`):

```sql
UPDATE user_sessions
SET viewed_at = NOW()
WHERE user_id = $1 AND sequence_order = $2 AND viewed_at IS NULL;
```

**Response Schema:**

```json
{
  "sequence_order": 3,
  "question": "What year was the company founded?",
  "options": {
    "A": "2018",
    "B": "2019",
    "C": "2020",
    "D": "2021"
  }
}
```

---

### T10: Implement Submit Answer Endpoint

**Description:**

Implement the `/api/quiz/answer` endpoint that saves the user's answer for a given question sequence. When the answer is for question 10 (the last question), this endpoint also finalizes the quiz: logs `completed_at`, calculates the score, and marks the quiz as completed.

**Dependencies:**

- T9

**Acceptance Criteria:**

- [ ] Endpoint `POST /api/quiz/answer` accepts `{ sequence_order: 3, answer: "C" }`
- [ ] Updates `user_answer` in `user_sessions` table
- [ ] `user_id` MUST come from the verified JWT, never from the request body
- [ ] Records `answered_at` using PostgreSQL `NOW()`
- [ ] Validates answer is A, B, C, or D
- [ ] **Rejects if answer already exists for this sequence** (409 Conflict)
- [ ] **Enforces sequential ordering:** rejects if any prior sequence is unanswered (409 Conflict) — prevents a user from skipping ahead via direct API calls
- [ ] Returns success confirmation
- [ ] **When `sequence_order` is 10:** also logs `completed_at`, calculates score, updates `score` in `users` table, and returns completion confirmation **with the final score**

**Completion Response (Q10):**

```json
{
  "success": true,
  "completed": true,
  "score": 8
}
```

**Score Calculation (triggered on Q10):**

```sql
SELECT COUNT(*) AS score
FROM user_sessions us
JOIN questions q ON us.question_id = q.id
WHERE us.user_id = $1 AND us.user_answer = q.correct_opt;
```

---

## Phase 5: Leaderboard API

### T11: Implement Leaderboard Endpoint

**Description:**

Implement the `/api/leaderboard` endpoint that returns ranked user scores.

**Dependencies:**

- T10

**Acceptance Criteria:**

- [ ] Endpoint `GET /api/leaderboard` returns ranked list
- [ ] Sorted by `score` DESC
- [ ] Ties broken by `(completed_at - started_at)` ASC
- [ ] Returns user name, score, and duration

**Response Schema:**

```json
[
  {
    "rank": 1,
    "name": "John Doe",
    "employee_id": "EMP123",
    "score": 10,
    "duration_seconds": 245
  }
]
```

---

## Phase 6: Security

### T12: Configure CORS Policy

**Description:**

Configure Express CORS to only accept requests from the configured `FRONTEND_URL`.

**Dependencies:**

- T2

**Acceptance Criteria:**

- [ ] CORS only allows requests from `FRONTEND_URL`
- [ ] Preflight requests are handled
- [ ] Un authorized origins receive 403

---

### T13: Implement JWT Validation Middleware

**Description:**

Create middleware that validates JWT tokens on all protected routes.

**Dependencies:**

- T5

**Acceptance Criteria:**

- [ ] All `/api/*` endpoints (except auth) require Bearer token
- [ ] Invalid tokens return 401 Unauthorized
- [ ] Missing token returns 401
- [ ] Expired tokens return 401

---

### T14: Implement Deadline Check Middleware

**Description:**

Create middleware that rejects requests after the event deadline.

**Dependencies:**

- T2

**Acceptance Criteria:**

- [ ] All quiz endpoints check against `EVENT_DEADLINE_ISO`
- [ ] After deadline returns 403 Forbidden
- [ ] Message: "The event has concluded."

---

## Phase 7: Testing

### T15: Set Up Testing Infrastructure

**Description:**

Configure the testing framework and infrastructure for backend API integration tests.

**Dependencies:**

- T1

**Acceptance Criteria:**

- [ ] Vitest configured as test runner
- [ ] supertest installed for HTTP assertions against Express app
- [ ] Test environment uses a separate test database or transaction-based cleanup
- [ ] Test helper utilities for creating authenticated requests (valid JWT generation)
- [ ] `npm test` runs the full suite
- [ ] Each test starts with a clean database state

**Required Dependencies:**

```json
{
  "devDependencies": {
    "vitest": "^1.x",
    "supertest": "^6.x",
    "@types/supertest": "^6.x"
  }
}
```

---

### T16: Auth API Integration Tests

**Description:**

Write integration tests covering the authentication and onboarding endpoints.

**Dependencies:**

- T15, T6

**Acceptance Criteria:**

- [ ] `POST /api/auth/google`
    - [ ] New user: creates user record, returns JWT + `onboarding_required: true`
    - [ ] Existing user: returns JWT + correct onboarding status
    - [ ] Domain restriction: rejects when `RESTRICT_DOMAIN` is set and email domain doesn't match
    - [ ] Invalid Google token: returns 401
    - [ ] JWT has `expiresIn` of 2 hours
- [ ] `POST /api/auth/onboard`
    - [ ] Success: saves `employee_id`, returns confirmation
    - [ ] Duplicate `employee_id`: returns 409 Conflict
    - [ ] Already onboarded (user has `employee_id`): returns 409 Conflict
    - [ ] Empty `employee_id`: returns 400 Bad Request

---

### T17: Quiz API Integration Tests

**Description:**

Write integration tests covering the full quiz lifecycle — start, fetch questions, submit answers, and completion.

**Dependencies:**

- T15, T10

**Acceptance Criteria:**

- [ ] `GET /api/quiz/status`
    - [ ] Not started: returns `{ started: false }`
    - [ ] In progress: returns `current_sequence`
    - [ ] Completed: returns `score`, `started_at`, `completed_at`
- [ ] `POST /api/quiz/start`
    - [ ] Success: creates exactly 10 session rows (6 faq, 4 trivia), returns 200
    - [ ] Already started: returns existing session data (idempotent), does not reset timer
    - [ ] Not onboarded: returns 403 Forbidden
    - [ ] Insufficient questions in DB: returns 503 Service Unavailable
- [ ] `GET /api/quiz/question/:sequence`
    - [ ] Success: returns question without `correct_opt`
    - [ ] Backtracking (answered sequence): returns 403 Forbidden
    - [ ] Forward-jumping (unanswered sequence ahead of current): returns 403 Forbidden
    - [ ] Out-of-range sequence: returns 404
- [ ] `POST /api/quiz/answer`
    - [ ] Success: saves answer, returns confirmation
    - [ ] Duplicate answer for same sequence: returns 409 Conflict
    - [ ] Out-of-order (prior sequence unanswered): returns 409 Conflict
    - [ ] Q10 completion: logs `completed_at`, calculates score, returns `{ completed: true, score: N }`

---

### T18: Security & Leaderboard Integration Tests

**Description:**

Write integration tests for security middleware and the leaderboard endpoint.

**Dependencies:**

- T15, T14

**Acceptance Criteria:**

- [ ] JWT middleware
    - [ ] Missing token: returns 401
    - [ ] Invalid token: returns 401
    - [ ] Expired token: returns 401
    - [ ] Valid token: allows request through
- [ ] Deadline middleware
    - [ ] Before deadline: allows request
    - [ ] After deadline: returns 403 with "The event has concluded."
- [ ] CORS
    - [ ] Request from `FRONTEND_URL`: succeeds
    - [ ] Request from different origin: rejected
- [ ] `GET /api/leaderboard`
    - [ ] Sorted by `score` DESC
    - [ ] Ties broken by `(completed_at - started_at)` ASC
    - [ ] Empty leaderboard: returns empty array
    - [ ] Excludes users who haven't completed the quiz

---

## Dependencies Matrix

```
T1 ──► T2 ──┬──► T3 ──┬──► T4
            │         │
            │         └──► T5 ──┬──► T6
            │                  │
            │                  ├──► T7 ──► T8 ──► T9 ──► T10 ──► T11
            │                  │
            │                  └──► T13 (JWT Middleware)
            │
            ├──► T12 (CORS)
            │
            ├──► T14 (Deadline Check)
            │
            └──► T15 ──┬──► T16 (Auth tests, depends on T6)
                       ├──► T17 (Quiz tests, depends on T10)
                       └──► T18 (Security tests, depends on T14)
```

**Legend:**

- `A ─────► B` means A must complete before B can start
- Tasks T16–T18 also depend on completed API tasks (noted in parentheses) but those are not sequential blockers for test infrastructure setup