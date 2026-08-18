# Backend Development Rules

## General

Node.js 24 + Express.js 5 + TypeScript. `better-sqlite3` directly on SQLite (single-file DB, NO ORM, single process). Layered: route → middleware → db. Auth via Google OAuth (`google-auth-library`) + app JWT (`jsonwebtoken`). Structured JSON logging via `utils/logger.ts`.

## Project Structure

```
backend/
    src/
        index.ts            # Express app entry: CORS, JSON, middleware chain, graceful shutdown
        routes/             # auth.ts, quizzes.ts, admin/quizzes.ts, leaderboard.ts, health.ts
        middleware/         # auth.ts (JWT verify + isAdmin), error.ts, require-admin.ts
        db/                 # index.ts — better-sqlite3 connection, prepared statements
        utils/              # logger.ts — structured JSON logger
        seed.ts             # idempotent seed of the SQLite schema (tables + indexes)
    data/
        nanoquiz.sqlite     # the single-file DB (gitignored; created at boot if missing)
    tests/                 # Vitest + supertest HTTP-level tests
```

## Layering — route → middleware → db

Never skip layers.

- **Routes** (`routes/*.ts`): HTTP only. Parse and validate input, call the DB layer (or service logic that needs a transaction), shape the response. Business logic that spans multiple queries (quiz start seed, final scoring) lives here or in a dedicated module.
- **Middleware** (`middleware/*.ts`): cross-cutting concerns — JWT verify (`auth.ts`), admin gate (`require-admin.ts`), error handling (`error.ts`). Attaches `userId` (and `isAdmin`) to the request.
- **DB** (`db/index.ts`): owns the single `better-sqlite3` connection. Exposes typed prepared-statement helpers. No ad-hoc connections in routes.

## Database (better-sqlite3, no ORM)

- **Prepared statements / parameterized queries only.** Always `?` bound params. NEVER string-concatenate user input into SQL.
- SQLite is synchronous — no async DB calls. `db` statements are prepared once at module load; transactions via `db.transaction()` / `BEGIN`/`COMMIT`/`ROLLBACK`.
- **Timing:** business timestamps use SQLite's `strftime('%Y-%m-%dT%H:%M:%fZ','now')` (server clock) or a `timestamp` default in the schema. The client's reported `elapsedMs` is used only for leaderboard duration — never for correctness gating.
- Schema lives in `src/db/schema.ts` (or a `.sql` file applied at boot via `db.exec`) — canonical DDL: tables, indexes. `npm run seed` applies it idempotently.
- One process, one DB file. No WAL-mode concurrency concerns in single-process dev; enable WAL only if profiling shows contention.

## API Client / Contract

- All `/api/*` endpoints (except auth) require `Bearer <JWT>` in the Authorization header.
- Endpoints: `POST /api/auth/google`, `GET /api/quizzes`, `POST /api/quizzes/:id/start`, `GET /api/quizzes/:id/question/:seq`, `POST /api/quizzes/:id/submit`, `GET /api/quizzes/:id/leaderboard`, admin CRUD under `/api/admin/quizzes...`, `GET /health`.
- Full spec: `docs/api-docs/API.md`.

## Validation

- Validate input at the route edge (Google ID token, quiz CRUD bodies, question payloads, submit answers array, seq param).
- Reject malformed input with `400` + the project's error envelope.
- Never echo raw input back in a way that enables XSS/reflected injection.

## Transactions

- Use `db.transaction()` (or explicit `BEGIN`/`COMMIT`/`ROLLBACK` in try/catch/finally) for multi-statement mutations (quiz start seed, final scoring).
- Never hold a transaction open across an external HTTP call.
- Always roll back on error.

## Error Handling

- Consistent JSON envelope: `{ "error": "...", "message": "..." }`.
- Status mapping: `400` validation, `401` auth, `403` forbidden/not-started/wrong-sequence/quiz-inactive, `404` not found, `409` conflict (already participated), `500` server error.
- Never leak stack traces, SQL, or secrets.
- Never swallow in empty `catch {}` — log via `logger.warn`/`logger.error` with context, or rethrow.

## Logging

- `utils/logger.ts` — structured JSON. `logger.info`/`logger.warn` to stdout, `logger.error` to stderr.
- Never `console.log` in production paths.
- **Never** log secrets, JWTs, credentials, PII, or full request/response payloads. Mask identifiers.

## Auth

- `POST /api/auth/google` — verify Google ID token via `google-auth-library` `verifyIdToken`. Enforce `RESTRICT_DOMAIN` if set. Upsert user. Issue app JWT with `expiresIn: '2h'` carrying `userId` + `isAdmin`.
- `isAdmin` — determined on each login by checking the user's email against `ADMIN_EMAILS` (comma-separated env list). Rides in the JWT; `require-admin` middleware trusts it.
- `middleware/auth.ts` — verify Bearer JWT via `jsonwebtoken`, attach `userId` + `isAdmin`.

## Quiz Rules (domain constraints)

1. **No mid-way storage** — nothing is persisted until the quiz is completed. Start returns a random `seed`; the shuffled question set for the contestant is derived deterministically from it (seeded PRNG over the quiz's question IDs). The client sends the `seed` + `quizId` on each question fetch and on submit.
2. **No correct answers exposed** — `correct_opt` is NEVER sent to the client. Scoring is server-side, triggered on the final submit (answers array + elapsedMs).
3. **Single participation** — a completed attempt permanently disables Start for that user+quiz (`participations` row). An abandoned attempt (no submit) leaves no record and the user may restart.
4. **Sequential access / no backtracking** — question fetch serves `seq` by deterministic derivation; the client cannot skip or revisit (client-enforced; server serves by seq).
5. **Quiz active window** — a quiz is startable only while `now` is within `start_at`/`end_at` (403 otherwise). In-flight attempts continue past `end_at`.
6. **Client-side timer** — per-quiz `time_limit_seconds` (default 15) is enforced client-side; auto-advance on timeout including the last question. Elapsed time is client-reported (`elapsedMs`).
7. **Admin edits** — a quiz with any attempt can be deleted but not edited. `question_count` must not exceed the current question bank size (validation at save).

## Build and Run

```bash
cd backend
npm run dev          # tsx watch with hot reload (port 3000)
npm run build        # tsc compile
npm start            # Production: node dist/index.js
npm run seed         # Idempotent schema seeding
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # vitest
```

## Environment Variables (`backend/.env`)

| Variable | Required | Notes |
|----------|----------|-------|
| `PORT` | No | Default 3000 |
| `FRONTEND_URL` | Yes | VPS/nginx frontend origin (CORS) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth |
| `JWT_SECRET` | Yes | App JWT signing |
| `ADMIN_EMAILS` | Yes | Comma-separated admin emails |
| `DB_PATH` | No | SQLite file path (default `backend/data/nanoquiz.sqlite`) |
| `RESTRICT_DOMAIN` | No | Email domain restriction |

## Avoid

- `console.log` / `console.error` in production (use `utils/logger.ts`).
- String-concatenated SQL — prepared statements only.
- Creating ad-hoc `better-sqlite3` connections outside `db/index.ts`.
- Client-supplied data for correctness gating (seeds/answers are validated server-side; only `elapsedMs` is accepted as a value for the leaderboard).
- Sending `correct_opt` (or any answer key) to the frontend.
- Swallowed exceptions.
- Hardcoded URLs, hosts, ports, credentials.
- Exposing internal stack traces via API responses.