# Security Rules

## Sacred

- **Never commit secrets.** Google OAuth client IDs/secrets, JWT signing keys, DB connection strings (Supabase), — all via environment variables (`backend/.env`, `frontend/.env`, both gitignored).
- **Never log secrets, JWTs, credentials, PII, or full request/response payloads.** Mask identifiers (`userId=42`).
- **Never bypass pre-commit hooks** (`--no-verify`) — fix the issue.

## Authentication (Google OAuth 2.0 + App JWT)

- `POST /api/auth/google`: verify the Google ID token server-side via `google-auth-library` `verifyIdToken` — never trust the client to say who they are.
- Validate the token's `aud` claim equals the configured `GOOGLE_CLIENT_ID`.
- If `RESTRICT_DOMAIN` is set, reject tokens whose email domain doesn't match.
- Issue the app JWT with `jsonwebtoken` using `JWT_SECRET`, `expiresIn: '2h'` (2-hour expiry accommodates quiz duration + crash-recovery buffer; prevents indefinite validity).
- `middleware/auth.ts` verifies the Bearer JWT on every protected endpoint and attaches `userId` to the request. Expired/invalid tokens → `401`.

## No Answer Leakage (anti-cheat)

- **`correct_opt` is NEVER sent to the frontend.** The question-fetch endpoint omits it from the response payload.
- Scoring happens entirely server-side — triggered when the 10th answer is submitted.
- Validation and scoring run on the server via PostgreSQL; the client has no insight into correctness.

## Server-Side Timing (anti-cheat)

- All business timestamps (`started_at`, `completed_at`, `viewed_at`, `answered_at`, `duration_seconds`) use PostgreSQL `NOW()`.
- **Client-supplied timestamps are fully ignored** — prevents system-clock manipulation.

## Single Attempt

- Application level: `POST /api/quiz/start` aborts if the user already has `started_at`.
- Database level: trigger `prevent_multiple_quiz_attempts` blocks inserts into `user_sessions` if the user already has 10 session rows or `completed_at` set. Defense-in-depth.

## Sequential Access

- Question fetch rejects any sequence other than the user's current first-unanswered question → `403`. Prevents backtracking and forward-jumping.

## SQL Injection

- **Parameterized queries only** (`$1`, `$2`, ...). NEVER string-concatenate user input into SQL/JPQL.

## CORS

- Backend CORS restricts allowed origins to `FRONTEND_URL` exactly. Never `*` in production. Handle OPTIONS preflight.

## Event Deadline

- `EVENT_DEADLINE_ISO` enforced via `deadline.ts` middleware on quiz endpoints (`/api/quiz/start`, `/api/quiz/question/:seq`, `/api/quiz/answer`, `/api/quiz/timeout`). Past deadline → `403` "The event has concluded."
- Exempt: `GET /api/quiz/status` (so completed users can still see results), leaderboard, and auth endpoints.

## Input Validation

- Validate at the route edge (JWT payload, `employee_id`, `sequence_order`, `answer`, seed JSON schema).
- Reject malformed input with `400` + consistent error envelope. Never echo raw input back.
- Sanitize/validate anything rendered in the client — React escapes by default; avoid `dangerouslySetInnerHTML`.

## Persistence

- Parameterized queries / the project's `query<T>()` helper only.
- Sensitive columns encrypted at rest via application-layer encryption when justified; never rely solely on DB-level encryption.

## Cross-Cutting

- **Rate limiting** — considered for login/OTP-adjacent endpoints if required.
- **Security headers** — `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` on the backend/app host where applicable.
- **Cookies/tokens** — app JWT is short-lived (2h); never log it.

## Secrets Management

- Local dev: `.env` (gitignored) + `dotenv`. Real secrets never committed.
- CI: GitHub Actions secrets, masked in logs.
- Production: external secrets manager — never bake into image/repo.

## Dependency Hygiene

- Dependabot enabled; `high`/`critical` CVEs for runtime deps block merge.
- No new dependency without license review + CVE scan.

## What Not to Do

- Don't send `correct_opt` (or any answer key) to the client, ever.
- Don't trust client timestamps for any scoring/duration calculation.
- Don't trust client identity — always verify via `google-auth-library` + JWT middleware.
- Don't log request bodies, response bodies, authorization headers, JWTs, or DB connection strings.
- Don't store passwords (this app uses Google OAuth only — no password auth).
- Don't expose internal stack traces via API responses.
- Don't skip the DB single-attempt trigger as "redundant" — it's defense-in-depth.