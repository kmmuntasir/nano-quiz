# OpenQuiz API Documentation

| | |
|---|---|
| **Version** | 1.0.0 |
| **Base URL** | `https://your-api.onrender.com/api` |
| **Authentication** | Bearer Token (JWT) |

---

# Common Response Types

## 400 Bad Request

Returned when the request body is invalid, missing required fields, or contains malformed data.

```json
{
  "error": "Error message"
}
```

## 401 Unauthorized

Returned when the JWT token is missing, invalid, or expired.

```json
{
  "error": "Unauthorized"
}
```

## 403 Forbidden

Returned when:
- The event deadline has passed
- The user is not authorized to perform the action

```json
{
  "error": "The event has concluded."
}
```

## 404 Not Found

Returned when the requested resource does not exist.

```json
{
  "error": "Not found"
}
```

## 409 Conflict

Returned when attempting to perform an action that conflicts with the current state (e.g., duplicate answer, skipping questions).

```json
{
  "error": "Conflict message"
}
```

## 503 Service Unavailable

Returned when the service cannot complete the request due to external dependencies (e.g., insufficient questions in database).

```json
{
  "error": "Service message"
}
```

## 500 Internal Server Error

Returned when a database error occurs or an internal server constraint is violated.

```json
{
  "error": "Internal server error"
}
```

---

# Authentication Endpoints

> Auth endpoints (`/api/auth/*`) are not subject to the event deadline check.

---

## POST /api/auth/google

### Description

Verifies a Google JWT token, creates or retrieves the user, and issues an application JWT for session authentication.

### Request

| Parameter | Value |
|-----------|-------|
| Method | POST |
| Path | `/api/auth/google` |
| Auth | None |

### Request Body

```json
{
  "token": "GOOGLE_JWT"
}
```

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `token` | string | Yes | The JWT token from Google OAuth |

### Success Response (200 OK)

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "employee_id": null
  },
  "onboarding_required": true
}
```

### Error Responses

| Code | Condition | Body |
|------|-----------|------|
| 401 | Invalid Google token | `{ "error": "Invalid token" }` |
| 401 | Token expired | `{ "error": "Token expired" }` |
| 401 | Domain restriction | `{ "error": "Invalid domain. Only @<domain> emails are allowed." }` |

---

## POST /api/auth/onboard

### Description

Saves the user's employee ID during first-time setup. Must be called before starting a quiz.

### Request

| Parameter | Value |
|-----------|-------|
| Method | POST |
| Path | `/api/auth/onboard` |
| Auth | Required |

### Request Body

```json
{
  "employee_id": "EMP123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `employee_id` | string | Yes | Unique employee identifier |

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Onboarding completed successfully",
  "employee_id": "EMP123"
}
```

### Error Responses

| Code | Condition | Body |
|------|-----------|------|
| 401 | Missing token | `{ "error": "Unauthorized" }` |
| 401 | Invalid/expired token | `{ "error": "Unauthorized" }` |
| 400 | Empty employee_id | `{ "error": "Employee ID is required" }` |
| 409 | Duplicate employee_id | `{ "error": "Employee ID already exists" }` |
| 409 | Already onboarded | `{ "error": "User has already completed onboarding" }` |

---

# Quiz Endpoints

---

## GET /api/quiz/status

### Description

Checks the user's current quiz progress. **Exempt from deadline check** - users can retrieve results after the event ends.

### Request

| Parameter | Value |
|-----------|-------|
| Method | GET |
| Path | `/api/quiz/status` |
| Auth | Required |

### Success Responses (200 OK)

**Quiz Not Started:**
```json
{
  "started": false,
  "completed": false
}
```

**Quiz In Progress:**
```json
{
  "started": true,
  "completed": false,
  "current_sequence": 3,
  "started_at": "2024-01-15T10:00:00Z"
}
```

> **Note:** `current_sequence` is computed from `user_sessions` as the first unanswered question (where `user_answer IS NULL`). This field is not stored directly in the database.

**Quiz Completed:**
```json
{
  "started": true,
  "completed": true,
  "score": 8,
  "started_at": "2024-01-15T10:00:00Z",
  "completed_at": "2024-01-15T10:05:32Z",
  "duration_seconds": 332
}
```

---

## POST /api/quiz/start

### Description

Allocates 10 random questions (6 FAQ + 4 trivia) and starts the quiz timer. Questions are randomly selected from the database - FAQ questions cover company/policy topics while trivia questions are general knowledge.

The allocated questions are stored in the `user_sessions` table with sequence_order 1-10 and remain available for the duration of the quiz session.

### Request

| Parameter | Value |
|-----------|-------|
| Method | POST |
| Path | `/api/quiz/start` |
| Auth | Required |

### Success Response (200 OK)

> **Idempotent:** If the user has already started the quiz (i.e., `started_at` is set), this endpoint returns the existing session data without resetting the timer or reallocating questions.

```json
{
  "started": true,
  "completed": false,
  "current_sequence": 1,
  "started_at": "2024-01-15T10:00:00Z"
}
```

### Error Responses

| Code | Condition | Body |
|------|-----------|------|
| 403 | Not onboarded | `{ "error": "Onboarding required before starting quiz" }` |
| 403 | Deadline passed | `{ "error": "The event has concluded." }` |
| 403 | Quiz already completed | `{ "error": "You have already completed the quiz" }` |
| 503 | Insufficient questions | `{ "error": "Insufficient questions in database" }` |

---

## GET /api/quiz/question/:sequence

### Description

Fetches a specific question by sequence order (1-10) from the user's allocated question set. **Does not include `correct_opt`** in the response.

> **Per-question timing:** When `TRACK_PER_QUESTION_TIME` is enabled, the server records when each question is first viewed (`viewed_at`). This data is used for admin analytics only and does not affect scoring or the leaderboard.

### Request

| Parameter | Value |
|-----------|-------|
| Method | GET |
| Path | `/api/quiz/question/:sequence` |
| Auth | Required |
| Path Params | `sequence` (integer, 1-10) |

### Success Response (200 OK)

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

### Error Responses

| Code | Condition | Body |
|------|-----------|------|
| 403 | Backtracking (answered) | `{ "error": "Cannot access previous questions" }` |
| 403 | Forward-jumping (unanswered) | `{ "error": "Must answer questions in order" }` |
| 404 | Sequence not in user's allocated set | `{ "error": "Not found" }` |
| 403 | Deadline passed | `{ "error": "The event has concluded." }` |

---

## POST /api/quiz/answer

### Description

Saves the user's answer. On question 10, also calculates score and marks quiz complete.

### Request

| Parameter | Value |
|-----------|-------|
| Method | POST |
| Path | `/api/quiz/answer` |
| Auth | Required |

### Request Body

```json
{
  "sequence_order": 3,
  "answer": "C"
}
```

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `sequence_order` | integer | Yes | Question sequence (1-10) |
| `answer` | string | Yes | Selected option (A, B, C, or D) |

### Success Response (200 OK)

**Questions 1-9:**
```json
{
  "success": true,
  "sequence_order": 3
}
```

**Question 10 (Completion):**
```json
{
  "success": true,
  "completed": true,
  "score": 8,
  "completed_at": "2024-01-15T10:05:32Z",
  "duration_seconds": 245
}
```

### Error Responses

| Code | Condition | Body |
|------|-----------|------|
| 400 | Invalid answer | `{ "error": "Answer must be one of: A, B, C, D" }` |
| 409 | Duplicate answer | `{ "error": "Answer already submitted for this question" }` |
| 409 | Skipped question | `{ "error": "Must answer questions in order" }` |
| 409 | Already completed | `{ "error": "User has already completed the quiz" }` |
| 403 | Deadline passed | `{ "error": "The event has concluded." }` |

---

# Leaderboard Endpoints

---

## GET /api/leaderboard

### Description

Returns ranked list of users who completed the quiz. **Not subject to deadline check**.

### Request

| Parameter | Value |
|-----------|-------|
| Method | GET |
| Path | `/api/leaderboard` |
| Auth | Required |

### Success Response (200 OK)

```json
[
  {
    "rank": 1,
    "name": "John Doe",
    "employee_id": "EMP123",
    "score": 10,
    "duration_seconds": 245
  },
  {
    "rank": 2,
    "name": "Jane Smith",
    "employee_id": "EMP456",
    "score": 9,
    "duration_seconds": 312
  }
]
```

### Empty Response (200 OK)

```json
[]
```

### Sorting Rules

| Priority | Field | Order |
|----------|-------|-------|
| 1 | `score` | DESC |
| 2 | `duration_seconds` | ASC |

---

# Authentication Flow

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

JWT tokens expire after **2 hours**.

# Rate Limits

No rate limiting is currently enforced.

# CORS Policy

The API enforces strict Cross-Origin Resource Sharing (CORS) policies. Only requests originating from the configured `FRONTEND_URL` environment variable are accepted. Preflight (`OPTIONS`) requests are handled automatically. Requests from unauthorized origins are rejected.

# Environment Variables

The backend is configured via environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (default: 3000) |
| `FRONTEND_URL` | Yes | Allowed origin for CORS |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `JWT_SECRET` | Yes | Secret key for signing JWTs |
| `SUPABASE_DB_URL` | Yes | PostgreSQL connection string |
| `RESTRICT_DOMAIN` | No | Allowed email domain (e.g., "exabyting.com"). Leave blank to allow any Gmail |
| `EVENT_DEADLINE_ISO` | No | ISO 8601 timestamp. Stops quiz submissions after this time |
| `TRACK_PER_QUESTION_TIME` | No | Set to `true` to record per-question timing for analytics |

# Event Deadline

When the `EVENT_DEADLINE_ISO` environment variable is set, the server enforces a submission deadline. After the deadline passes, affected endpoints return `403 Forbidden` with `{ "error": "The event has concluded." }`.

| Endpoint | Deadline Enforced |
|----------|-------------------|
| `POST /api/quiz/start` | Yes |
| `GET /api/quiz/question/:sequence` | Yes |
| `POST /api/quiz/answer` | Yes |
| `GET /api/quiz/status` | No — users can retrieve results after deadline |
| `GET /api/leaderboard` | No |
| `/api/auth/*` | No |
| `GET /health` | No |

If `EVENT_DEADLINE_ISO` is blank or unset, the quiz remains open indefinitely.

# Error Handling

All errors follow a consistent JSON format:

```json
{
  "error": "Error message"
}
```

Success responses that include data use the appropriate data structure for each endpoint.

---

# System Endpoints

---

## GET /health

### Description

Health check endpoint for monitoring and deployment verification. Not subject to authentication or deadline checks.

### Request

| Parameter | Value |
|-----------|-------|
| Method | GET |
| Path | `/health` |
| Auth | None |

### Success Response (200 OK)

```json
{
  "status": "healthy",
  "database": "connected"
}
```

### Error Response (503 Service Unavailable)

```json
{
  "status": "unhealthy"
}
```