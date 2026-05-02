# Backend Task Breakdown Documentation

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Project Setup](#phase-1-project-setup)
3. [Phase 2: Database](#phase-2-database)
4. [Phase 3: Authentication](#phase-3-authentication)
5. [Phase 4: Quiz API](#phase-4-quiz-api)
6. [Phase 5: Admin API](#phase-5-admin-api)
7. [Phase 6: Security](#phase-6-security)
8. [Dependencies Matrix](#dependencies-matrix)

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
| 2 | 2 | Database connection and seeding |
| 3 | 2 | Google OAuth and onboarding |
| 4 | 5 | Quiz flow (status, start, question, answer, submit) |
| 5 | 1 | Leaderboard endpoint |
| 6 | 4 | Security middleware |

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
    "uuid": "^9.x"
  },
  "devDependencies": {
    "@types/express": "^4.x",
    "@types/cors": "^2.x",
    "@types/pg": "^8.x",
    "@types/jsonwebtoken": "^9.x",
    "@types/uuid": "^9.x",
    "typescript": "^5.x",
    "ts-node": "^10.x"
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
ON CONFLICT DO NOTHING;
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

```json
{
  "started": true,
  "completed": false,
  "current_sequence": 3,
  "started_at": "2024-01-15T10:00:00Z"
}
```

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
- [ ] Idempotent: aborts if user already has `started_at`

**Database Transaction:**

```sql
BEGIN;
UPDATE users SET started_at = NOW() WHERE id = $1 AND started_at IS NULL;
INSERT INTO user_sessions (user_id, question_id, sequence_order)
SELECT $1, question_id, sequence_order
FROM (
  SELECT id AS question_id, ROW_NUMBER() OVER (ORDER BY random()) AS sequence_order
  FROM questions
  WHERE category = 'faq'
  ORDER BY random()
  LIMIT 6
) faq
JOIN (
  SELECT id AS question_id, ROW_NUMBER() OVER (ORDER BY random()) AS sequence_order
  FROM questions
  WHERE category = 'trivia'
  ORDER BY random()
  LIMIT 4
) trivia ON faq.sequence_order = trivia.sequence_order;
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

Implement the `/api/quiz/answer` endpoint that saves the user's answer for a given question sequence.

**Dependencies:**

- T9

**Acceptance Criteria:**

- [ ] Endpoint `POST /api/quiz/answer` accepts `{ sequence_order: 3, answer: "C" }`
- [ ] Updates `user_answer` in `user_sessions` table
- [ ] Validates answer is A, B, C, or D
- [ ] Returns success confirmation

---

### T11: Implement Quiz Submit Endpoint

**Description:**

Implement the `/api/quiz/submit` endpoint that finalizes the quiz, calculates the score, and stops the timer.

**Dependencies:**

- T10

**Acceptance Criteria:**

- [ ] Endpoint `POST /api/quiz/submit` finalizes quiz
- [ ] Records `completed_at` using PostgreSQL `NOW()`
- [ ] Calculates score by joining `user_sessions` with `questions`
- [ ] Updates `score` in `users` table
- [ ] Marks quiz as completed
- [ ] Returns confirmation (NOT the score)

**Score Calculation:**

```sql
SELECT COUNT(*) AS score
FROM user_sessions us
JOIN questions q ON us.question_id = q.id
WHERE us.user_id = $1 AND us.user_answer = q.correct_opt;
```

---

## Phase 5: Admin API

### T12: Implement Leaderboard Endpoint

**Description:**

Implement the `/api/admin/leaderboard` endpoint that returns ranked user scores.

**Dependencies:**

- T11

**Acceptance Criteria:**

- [ ] Endpoint `GET /api/admin/leaderboard` returns ranked list
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

### T13: Configure CORS Policy

**Description:**

Configure Express CORS to only accept requests from the configured `FRONTEND_URL`.

**Dependencies:**

- T2

**Acceptance Criteria:**

- [ ] CORS only allows requests from `FRONTEND_URL`
- [ ] Preflight requests are handled
- [ ] Un authorized origins receive 403

---

### T14: Implement JWT Validation Middleware

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

### T15: Implement Deadline Check Middleware

**Description:**

Create middleware that rejects requests after the event deadline.

**Dependencies:**

- T2

**Acceptance Criteria:**

- [ ] All quiz endpoints check against `EVENT_DEADLINE_ISO`
- [ ] After deadline returns 403 Forbidden
- [ ] Message: "The event has concluded."

---

### T16: Implement Idempotency Check

**Description:**

Ensure `/api/quiz/start` cannot overwrite an existing session.

**Dependencies:**

- T7

**Acceptance Criteria:**

- [ ] If `started_at` exists, endpoint aborts
- [ ] Returns existing session data
- [ ] Timer is not reset

---

## Dependencies Matrix

```
T1  ─────┬──► T2 ─────┬──► T3 ─────┬──► T4
        │            │            │
        │            │            └────────► T5
        │            │                        │
        │            │                        ├────────► T6
        │            │                        │
        │            └──────────────────────┼────────► T7
        │                                     │         │
        │                                     │         └────────► T8 ─────► T9 ─────► T10 ─────► T11 ─────► T12
        │                                     │                                     │
        │                                     └─────────────────────────────────────┘
        │
        └──────────────────────────────────────┘
                                                │
                                                ├────────► T13
                                                ├────────► T14
                                                ├────────► T15
                                                └────────► T16
```

**Legend:**

- `A ─────► B` means A must complete before B can start