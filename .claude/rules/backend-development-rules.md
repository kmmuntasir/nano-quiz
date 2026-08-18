# Backend Development Rules

## General

Node.js 24 + Express.js 5 + TypeScript. `pg` driver directly on PostgreSQL (NO ORM). Maven is not used — everything is npm. Layered: route → middleware → db. Auth via Google OAuth (`google-auth-library`) + app JWT (`jsonwebtoken`). Structured JSON logging via `utils/logger.ts`.

## Project Structure

```
backend/
    src/
        index.ts            # Express app entry: CORS, morgan logging, middleware chain, graceful shutdown
        routes/             # auth.ts, quiz.ts, leaderboard.ts, health.ts
        middleware/         # auth.ts (JWT verify), cors.ts, deadline.ts
        db/                 # index.ts — pg.Pool, query<T>() helper, getClient()
        utils/              # logger.ts — structured JSON logger
        seed.ts             # Idempotent question seeder from data/*.json
    data/
        faq_questions.json      # category: faq
        trivia_questions.json   # category: trivia
    tests/                 # Vitest + supertest HTTP-level tests
```

## Layering — route → middleware → db

Never skip layers.

- **Routes** (`routes/*.ts`): HTTP only. Parse and validate input, call the DB layer (or service logic that needs a transaction via `getClient()`), shape the response. Business logic that spans multiple queries (quiz allocation, scoring) lives here or in a dedicated module using `getClient()`.
- **Middleware** (`middleware/*.ts`): cross-cutting concerns — JWT verify (`auth.ts`), CORS + preflight (`cors.ts`), event deadline (`deadline.ts`). Attaches `userId` to the request.
- **DB** (`db/index.ts`): owns the single `pg.Pool`. Exposes `query<T>()` and `getClient()` for transactions. No ad-hoc pools in routes.

## Database (`pg`, no ORM)

- **Parameterized queries only.** Always `$1`, `$2` bound params. NEVER string-concatenate user input into SQL.
- `query<T>()` for single statements. `getClient()` + explicit `BEGIN`/`COMMIT`/`ROLLBACK` for multi-statement transactions (quiz start allocation, Q10 scoring).
- **Server-side timing:** all business timestamps use PostgreSQL `NOW()`. Client timestamps are ignored (anti-cheat constraint).
- Type query results against schema in `docs/data/schema.sql`.
- Schema changes live in `docs/data/schema.sql` (canonical DDL: tables, constraints, triggers, indexes) — applied via `psql`.

## API Client / Contract

- All `/api/*` endpoints (except auth) require `Bearer <JWT>` in the Authorization header.
- Endpoints: `POST /api/auth/google`, `POST /api/auth/onboard`, `GET /api/quiz/status`, `POST /api/quiz/start`, `GET /api/quiz/question/:seq`, `POST /api/quiz/answer`, `POST /api/quiz/timeout`, `GET /api/leaderboard`, `GET /health`.
- Full spec: `docs/api-docs/API.md`.

## Validation

- Validate input at the route edge (JWT payload for Google, `employee_id`, `sequence_order`/`answer`, question JSON schema at seed time).
- Reject malformed input with `400` + the project's error envelope.
- Never echo raw input back in a way that enables XSS/reflected injection.

## Transactions

- Use `getClient()` + `BEGIN`/`COMMIT`/`ROLLBACK` (try/catch/finally) for multi-statement mutations.
- Never hold a transaction open across an external HTTP call.
- Always roll back on error; release the client in `finally`.

## Error Handling

- Consistent JSON envelope: `{ "error": "...", "message": "..." }`.
- Status mapping: `401` auth, `403` forbidden/deadline/timed-out/sequential-access, `404` not found, `409` conflict (already answered / already started), `500` server error.
- Never leak stack traces, SQL, entity state, or secrets.
- Never swallow in empty `catch {}` — log via `logger.warn`/`logger.error` with context, or rethrow.

## Logging

- `utils/logger.ts` — structured JSON. `logger.info`/`logger.warn` to stdout, `logger.error` to stderr.
- Morgan HTTP logs piped through `logger.info` with `{ source: 'http' }`.
- Never `console.log` in production paths.
- **Never** log secrets, JWTs, credentials, PII, or full request/response payloads. Mask identifiers.

## Auth

- `POST /api/auth/google` — verify Google ID token via `google-auth-library` `verifyIdToken`. Enforce `RESTRICT_DOMAIN` if set. Upsert user. Issue app JWT with `expiresIn: '2h'`.
- `middleware/auth.ts` — verify Bearer JWT via `jsonwebtoken`, attach `userId`.
- `POST /api/auth/onboard` — save `employee_id` (first-time only).
- JWT: 2-hour expiry (accommodates quiz duration + crash recovery buffer).

## Quiz Rules (domain constraints)

1. **No backtracking / sequential access** — question fetch rejects any sequence that isn't the user's current first unanswered (403).
2. **Single attempt** — app-level `started_at` check + DB trigger `prevent_multiple_quiz_attempts`.
3. **No correct answers exposed** — `correct_opt` never sent to the client. Scoring happens server-side on Q10 answer.
4. **Server-side timing** — PostgreSQL `NOW()` for `started_at`, `completed_at`, `viewed_at`, `answered_at`.
5. **Event deadline** — `EVENT_DEADLINE_ISO` enforced via `deadline.ts` middleware (exempt: status, leaderboard).
6. **Per-question time limit** — `QUESTION_TIME_LIMIT_SECONDS` (default 10s) enforced via `viewed_at`. Expired → 403 `code: 'timed_out'`. Timeout endpoint marks question skipped.

## Build and Run

```bash
cd backend
npm run dev          # tsx watch with hot reload (port 3000)
npm run build        # tsc compile
npm start            # Production: node dist/index.js
npm run seed         # Idempotent question seeding from JSON files
npm run cleanup-db   # Drop quiz data (users, sessions) but keep questions
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # vitest
```

## Environment Variables (`backend/.env`)

| Variable | Required | Notes |
|----------|----------|-------|
| `PORT` | No | Default 3000 |
| `FRONTEND_URL` | Yes | Vercel URL (CORS origin) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth |
| `JWT_SECRET` | Yes | App JWT signing |
| `SUPABASE_DB_URL` | Yes | PostgreSQL connection string |
| `RESTRICT_DOMAIN` | No | Email domain restriction |
| `EVENT_DEADLINE_ISO` | No | ISO 8601 deadline |
| `TRACK_PER_QUESTION_TIME` | No | Record viewed_at per question |
| `QUESTION_TIME_LIMIT_SECONDS` | No | Per-question time limit (default 10) |
| `DB_SSL` | No | `false` to disable SSL for local dev |

## Avoid

- `console.log` / `console.error` in production (use `utils/logger.ts`).
- String-concatenated SQL — parameterized queries only.
- Creating ad-hoc `pg.Pool` instances outside `db/index.ts`.
- Client timestamps for any business timing — PostgreSQL `NOW()` only.
- Sending `correct_opt` (or any answer key) to the frontend.
- Swallowed exceptions.
- Hardcoded URLs, hosts, ports, credentials.
- Exposing the internal `QUERY_TEXT`/stack traces via API responses.