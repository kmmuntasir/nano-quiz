# Security Rules

## Sacred

- **Never commit secrets.** Google OAuth client IDs/secrets, JWT signing keys, `ADMIN_EMAILS` — all via environment variables (`backend/.env`, `frontend/.env`, both gitignored).
- **Never log secrets, JWTs, credentials, PII, or full request/response payloads.** Mask identifiers (`userId=42`).
- **Never bypass pre-commit hooks** (`--no-verify`) — fix the issue.

## Authentication (Google OAuth 2.0 + App JWT)

- `POST /api/auth/google`: verify the Google ID token server-side via `google-auth-library` `verifyIdToken` — never trust the client to say who they are.
- Validate the token's `aud` claim equals the configured `GOOGLE_CLIENT_ID`.
- If `RESTRICT_DOMAIN` is set, reject tokens whose email domain doesn't match.
- Issue the app JWT with `jsonwebtoken` using `JWT_SECRET`, `expiresIn: '2h'`, carrying `userId` and `isAdmin`.
- `isAdmin` is computed on login by checking the user's email against `ADMIN_EMAILS` (comma-separated). It rides in the JWT and is trusted by `require-admin` middleware for the request's lifetime.
- `middleware/auth.ts` verifies the Bearer JWT on every protected endpoint and attaches `userId` (+ `isAdmin`) to the request. Expired/invalid tokens → `401`.

## Admin Authorization

- Admin routes live under `/api/admin/*` and are gated by `require-admin` middleware (checks the `isAdmin` claim).
- The admin UI is hidden entirely from non-admins on the frontend (route guards + no admin links rendered). Hiding the UI is not the security boundary — the middleware is.

## No Answer Leakage (anti-cheat)

- **`correct_opt` is NEVER sent to the frontend.** The question-fetch endpoint omits it from the response payload.
- Scoring happens entirely server-side — triggered by the final quiz submit (`POST /api/quizzes/:id/submit`).
- The server never exposes the correct answers, per-question correctness, or the answer key in any response or log.

## Seed-Based Shuffle (anti-cheat)

- Starting a quiz returns a random `seed`; the per-contestant question order is derived deterministically from it with a seeded PRNG over the quiz's question IDs.
- The shuffle runs server-side; the client never knows the ordered list in advance and never receives the full question set at start.

## No Mid-Way Storage / Single Participation

- Nothing is persisted until the final submit. An abandoned attempt leaves no record.
- A completed attempt writes a `participations` row (user + quiz), permanently disabling Start for that user+quiz (server rejects `start` with `409`).

## SQL Injection

- **Prepared statements only** (`?` bound params via `better-sqlite3`). NEVER string-concatenate user input into SQL.

## CORS

- Backend CORS restricts allowed origins to `FRONTEND_URL` exactly. Never `*` in production. Handle OPTIONS preflight.

## Quiz Active Window

- `start` is rejected (`403`) when the current time is outside the quiz's `start_at`/`end_at`. In-flight attempts continue past `end_at`.

## Input Validation

- Validate at the route edge (Google ID token, quiz CRUD bodies, question payloads, submit answers array, seq param).
- Reject malformed input with `400` + consistent error envelope. Never echo raw input back.
- Sanitize/validate anything rendered in the client — React escapes by default; avoid `dangerouslySetInnerHTML`.

## Persistence

- Prepared statements / the project's `db` helper only.
- The SQLite file is gitignored; never commit the DB.

## Cross-Cutting

- **Rate limiting** — considered for auth/quiz-submit endpoints if required.
- **Security headers** — `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` on the backend/app host where applicable.
- **Cookies/tokens** — app JWT is short-lived (2h); never log it.

## Secrets Management

- Local dev: `.env` (gitignored) + `dotenv`. Real secrets never committed.
- CI: GitHub Actions secrets, masked in logs.
- Production: env vars on the VPS (systemd/PM2 env or `.env` in the deploy dir, never in git).

## Dependency Hygiene

- Dependabot enabled; `high`/`critical` CVEs for runtime deps block merge.
- No new dependency without license review + CVE scan.

## What Not to Do

- Don't send `correct_opt` (or any answer key) to the client, ever.
- Don't trust client identity — always verify via `google-auth-library` + JWT middleware.
- Don't log request bodies, response bodies, authorization headers, JWTs, or DB contents.
- Don't store passwords (this app uses Google OAuth only — no password auth).
- Don't expose internal stack traces via API responses.
- Don't grant admin without the `isAdmin` claim — the `ADMIN_EMAILS` env check runs at login, per request `isAdmin` comes from the JWT.
- Don't reveal per-question correctness or the answer key in any response.