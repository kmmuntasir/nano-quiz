# NanoQuiz API Specification

Base URL (dev): `http://localhost:3000/api` — production: `/api` via nginx reverse proxy.

All `/api/*` endpoints (except `POST /api/auth/google` and `GET /health`) require:

```
Authorization: Bearer <JWT>
```

The JWT carries `{ userId, isAdmin }` and expires after 2h.

## Error envelope

All errors use a consistent JSON shape:

```json
{ "error": "<machine-code>", "message": "<human message>" }
```

Status codes: `400` validation · `401` missing/invalid token · `403` forbidden / quiz inactive / wrong context · `404` not found · `409` conflict (already participated) · `500` server error.

---

## Auth

### `POST /api/auth/google`

Verify a Google ID token and issue the app JWT.

**Request**

```json
{ "idToken": "<google-id-token>" }
```

**Response** `200`

```json
{
  "token": "<app-jwt>",
  "user": { "id": "u1", "name": "Ada Lovelace", "email": "ada@example.com", "isAdmin": true }
}
```

`isAdmin` is computed by matching the email against `ADMIN_EMAILS`. No onboarding step — the Google profile name is used as the display name.

---

## Quizzes

### `GET /api/quizzes`

List all quizzes for the signed-in user. Every quiz is shown; inactive ones expose `canStart: false`.

**Response** `200`

```json
[
  {
    "id": "q1",
    "title": "General Knowledge",
    "description": "A 10-question general knowledge quiz.",
    "questionCount": 10,
    "timeLimitSeconds": 15,
    "startAt": "2026-08-01T09:00:00Z",
    "endAt": "2026-08-31T21:00:00Z",
    "canStart": true,
    "participated": false,
    "userScore": null
  }
]
```

`canStart` is `true` only when now is within `[startAt, endAt]` and the user has not participated. `userScore` is the user's score if they already participated.

### `POST /api/quizzes/:id/start`

Start the quiz. Returns a random `seed` from which the server deterministically derives the contestant's shuffled question order. **Nothing is persisted** — no record until the final submit.

**Response** `200`

```json
{ "seed": "a1b2c3d4e5", "quizId": "q1", "questionCount": 10, "timeLimitSeconds": 15 }
```

**Errors** `403` quiz not currently active · `409` user already participated.

### `GET /api/quizzes/:id/question/:seq?seed=...`

Fetch one question by 1-based sequence. The `seed` (from start) is required.

**Response** `200`

```json
{
  "seq": 1,
  "total": 10,
  "text": "What is the capital of France?",
  "options": ["Berlin", "Madrid", "Paris", "Rome"]
}
```

**Never includes `correct_opt` or any answer key.**

**Errors** `400` missing/empty seed or non-integer `seq` · `404` quiz not found / `seq` outside `1..questionCount` · `403` malformed seed (not 10-hex). No active-window gate — in-flight attempts continue past `endAt`.

### `POST /api/quizzes/:id/submit`

Final submit. Persists the participation (single, permanent) and scores server-side.

**Request**

```json
{
  "seed": "a1b2c3d4e5",
  "answers": [2, 0, 1, 3, 2, 1, 0, 2, 3, 1],
  "elapsedMs": 84213
}
```

`answers` is an array of selected option indices, one per question in seed order. `elapsedMs` is client-reported and used only for the leaderboard duration.

**Response** `200`

```json
{
  "score": 8,
  "totalQuestions": 10,
  "correctCount": 8,
  "durationMs": 84213,
  "participated": true
}
```

Correct answers are never returned. The submit is idempotent for a given user+quiz (a completed quiz returns the stored result).

**Errors** `400` missing seed / invalid `answers` or `elapsedMs` · `404` quiz not found · `403` malformed seed (not 10-hex). No active-window gate — in-flight submits land past `endAt`. A repeat submit is idempotent (`200` with the stored result); `409` already-participated applies to a second `start`, not submit.

### `GET /api/quizzes/:id/leaderboard?page=1&pageSize=20`

Paginated leaderboard for a quiz, ranked `score DESC, duration ASC`.

**Response** `200`

```json
{
  "quizId": "q1",
  "page": 1,
  "pageSize": 20,
  "total": 45,
  "entries": [
    { "rank": 1, "name": "Ada Lovelace", "score": 10, "durationMs": 42000 },
    { "rank": 2, "name": "Grace Hopper", "score": 9, "durationMs": 51000 }
  ]
}
```

---

## Admin

All admin endpoints require the JWT to carry `isAdmin: true` (`require-admin` middleware). Admin UI is hidden from non-admins on the frontend; the middleware is the real security boundary.

### `POST /api/admin/quizzes`

Create a quiz.

**Request**

```json
{
  "title": "General Knowledge",
  "description": "A 10-question general knowledge quiz.",
  "questionCount": 10,
  "timeLimitSeconds": 15,
  "startAt": "2026-08-01T09:00:00Z",
  "endAt": "2026-08-31T21:00:00Z"
}
```

**Response** `201` — the created quiz (same shape as `GET /api/quizzes` item, plus `id`).

**Errors** `400` validation (`questionCount` must be positive; `endAt` after `startAt`).

### `GET /api/admin/quizzes`

Admin's quiz list (includes attempt counts for delete/edit decisions).

**Response** `200`

```json
[
  {
    "id": "q1",
    "title": "General Knowledge",
    "questionCount": 10,
    "timeLimitSeconds": 15,
    "startAt": "2026-08-01T09:00:00Z",
    "endAt": "2026-08-31T21:00:00Z",
    "questionBankSize": 100,
    "attemptCount": 3
  }
]
```

### `PUT /api/admin/quizzes/:id`

Edit a quiz. **Blocked (`409`) once the quiz has any attempt.** `questionCount` must not exceed the current question bank size.

**Request** — same fields as create (all editable).

### `DELETE /api/admin/quizzes/:id`

Delete a quiz **and all its data** (questions, attempts, leaderboard entries). Allowed regardless of attempts.

### `GET /api/admin/quizzes/:id/questions`

List the quiz's question bank (admin sees `correctOpt`).

**Response** `200`

```json
[
  { "id": "qs1", "text": "What is the capital of France?", "options": ["Berlin", "Madrid", "Paris", "Rome"], "correctOpt": 2 }
]
```

### `POST /api/admin/quizzes/:id/questions`

Add a question to the bank.

**Request**

```json
{ "text": "What is the capital of France?", "options": ["Berlin", "Madrid", "Paris", "Rome"], "correctOpt": 2 }
```

**Response** `201` — the created question (with `id`).

### `PUT /api/admin/quizzes/:id/questions/:questionId`

Edit a question. **Blocked (`409`) once the quiz has any attempt.**

### `DELETE /api/admin/quizzes/:id/questions/:questionId`

Delete a question. **Blocked (`409`) once the quiz has any attempt** (deleting would break the active question set).

### `GET /api/admin/quizzes/:id/leaderboard`

Admin's read-only view of a quiz's leaderboard — same shape as the public leaderboard. No modification endpoints exist.

---

## Health

### `GET /health`

**Response** `200` `{ "status": "ok", "db": "ok" }` — includes a DB connectivity check.