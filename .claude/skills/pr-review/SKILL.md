---
name: pr-review
description: Comprehensive PR review covering the Node 24 / Express 5 / TypeScript backend and React 19 / TypeScript / Tailwind CSS frontend: architecture, correctness, security, and test coverage. Use when user requests to review a pull request or compare branches for code review.
---

# PR Review Skill

When user requests **PR review** or to **compare branches**:

### Branch Defaults

- **Source branch**: Current local branch. Determine with `git branch --show-current`.
- **Target branch**: `main`, unless user explicitly specifies different branch.
- If user specifies both branches, use those values.

### Pre-Review: Branch Synchronisation

Before review, both branches must be up-to-date and source must be rebased onto target.

**Standard mode** (online):

```bash
# 1. Fetch all remotes
git fetch --all

# 2. Reset target to origin
git checkout <target-branch> && git reset --hard origin/<target-branch>

# 3. Reset source to origin
git checkout <source-branch> && git reset --hard origin/<source-branch>

# 4. Rebase source onto target
git rebase <target-branch>
```

**Offline mode**: If user says **"offline"** when invoking this skill, skip steps 1-3 entirely. Only run rebase (step 4) against local copy of target branch. Allows reviewing purely local state without network access.

**Conflict handling**: If rebase in step 4 produces merge conflicts, **stop entire review**. Abort rebase (`git rebase --abort`), inform user of conflicts, do not proceed with any review steps.

**If rebase succeeds**: Proceed to review steps below.

### Parallel Subagent Strategy

Review accelerates using **up to 3 parallel subagents** (via `Agent` tool). Split independent review tasks across subagents to save context window and speed process. Example parallelisation:

| Subagent | Scope | Agent Type |
|----------|-------|------------|
| 1 | Diff analysis + architecture review | `general-purpose` |
| 2 | Stack-specific checks (Express backend + React/Tailwind frontend) | `general-purpose` |
| 3 | Test coverage assessment + code quality checklist | `general-purpose` |

**When to parallelise:** Always use parallel subagents when diff is non-trivial (more than few files). For tiny diffs (1-2 files, cosmetic changes), single-pass review fine.

**How to parallelise:** Launch all independent subagents in single message using multiple `Agent` tool calls. Each subagent receives diff (via `git diff`) and its specific review scope. After all subagents return, synthesize findings into final review summary (step 6).

## 1. Run Complete Diff

Compare source branch against target branch. Analyze **actual code changes**, not just commit messages.

```bash
git diff target..source
git log target..source --oneline
```

## 2. Identify Change Types

Determine what each change represents:
- Feature addition
- Bug fix
- Refactor
- Cleanup
- Potential breaking change

Note: missing tests, incomplete docs, inconsistencies.

## 3. Assess Code Quality & Impact

Evaluate:
- **Correctness**: Does code work as intended?
- **Readability**: Is code understandable?
- **Maintainability**: Will this be easy to modify later?
- **Architectural Alignment**: Does it follow project's patterns?
- **Performance Implications**: Any performance concerns?
- **Security Considerations**: Any vulnerabilities?

Check whether tests adequately cover changes.

## 4. Stack-Specific Review Items

### 4a. Node 24 / Express 5 / TypeScript Backend

**Layering**
- Route → middleware → db layering respected (no business logic dumped in middleware, no ad-hoc pools in routes)?
- Routes thin (HTTP only: parse/validate input, call db/service, shape response)?
- `db/index.ts` owns the single `pg.Pool`; `query<T>()` / `getClient()` used consistently?

**Persistence & Schema**
- **Parameterized queries only** (`$1`, `$2`, ...) — no string-concatenated SQL (injection risk)?
- Transactions via `getClient()` + `BEGIN`/`COMMIT`/`ROLLBACK` for multi-statement mutations?
- All business timestamps via PostgreSQL `NOW()` — no client timestamps for timing?
- Schema changes reflected in `docs/data/schema.sql`?

**Auth & Security**
- Google ID token verified server-side via `google-auth-library` (`verifyIdToken`); `aud` matches `GOOGLE_CLIENT_ID`?
- `RESTRICT_DOMAIN` enforced when set?
- JWT signed/verified with `JWT_SECRET`; `expiresIn: '2h'`; middleware attaches `userId`?
- **`correct_opt` never sent to the client** — scoring server-side only?
- CORS restricted to `FRONTEND_URL` (no `*` in prod)? Deadline middleware (`EVENT_DEADLINE_ISO`) applied to quiz endpoints (exempt: status, leaderboard)?
- No secrets/tokens/JWTs/payloads logged?

**Error Handling**
- Consistent JSON envelope `{ error, message }`; correct status codes (401/403/404/409)?
- No leaking stack traces, SQL, or secrets in responses?
- No swallowed exceptions (empty `catch {}`)?

**Logging**
- `utils/logger.ts` used — no `console.log`/`console.error` in production paths?

### 4b. React 19 / TypeScript / Tailwind CSS Frontend

**State Management**
- React Context (`AuthContext`) used for global/domain state; `useState` for local?
- No unnecessary new state libraries introduced?
- localStorage persistence handled cleanly; no stale-closure bugs in auto-fetch of `/quiz/status`?

**Hooks**
- Custom hooks extracted for reusable logic (`useAuth`, `useOfflineStatus`)?
- `useEffect`/`useMemo`/`useCallback` dependencies correct? Cleanup for timers (per-question countdown)?

**TypeScript**
- Explicit types instead of `any` (use `unknown` when truly unknown)?
- Interfaces/types defined for props and API responses, matching backend payloads exactly (no `correct_opt` invented)?
- Proper null handling? `import type` used for type-only imports?

**Error Handling**
- Errors caught and handled appropriately? `async`/`await` wrapped in `try/catch`?
- API errors surfaced via `ApiError`/`EventConcludedError`; `EventConcluded` screen shown on deadline?
- React error boundaries for component crashes?

**Component Design**
- Components focused (single responsibility)? Prop drilling avoided (use Context)?
- Functional components with hooks only?

**Routing**
- `/quiz/complete` defined **before** `/quiz/:sequence` (React Router top-to-bottom matching)?
- Lazy-loaded routes with Suspense + ErrorBoundary? `ProtectedRoute` gates applied (`requireEmployeeId`/`requireQuizStarted`/`requireQuizCompleted`)?

**Styling**
- Tailwind utility classes used — no stray inline `style={{}}`? Theme tokens from `tailwind.config.js` referenced (no magic arbitrary values when a token exists)?
- No new styling system introduced?

**Security**
- Secrets only in environment variables (`VITE_*`)? Token from `AuthContext`, injected via interceptor?
- `dangerouslySetInnerHTML` avoided? 401 auto-logout via interceptor working?

**API Client**
- Shared `apiClient` (`api/client.ts`) with interceptors used? Service functions return typed data?
- Backend contract matched exactly (no invented shapes)?

## 5. Test Coverage

- **Backend tests** present for new logic: Vitest + supertest HTTP-level tests, JWT generated per test via `jsonwebtoken`?
- **Frontend tests** use Vitest + Testing Library; MSW for API mocks?
- Error cases covered alongside happy paths (401/403/404/409, deadline, timed-out)?
- Mocks appropriate (`vi.fn()` / MSW for frontend; db-boundary stubs for backend)?
- Coverage: business logic >80%, components >70%?

## 6. Provide Senior-Level Review Summary

Offer direct, actionable feedback:
- Call out risks
- Highlight strengths
- Suggest improvements
- Indicate whether changes ready to merge or need revisions

## 7. Aim for Practical, High-Value Feedback

Goal: emulate real PR review from experienced engineer — clear, specific, focused on what matters.

## 8. Write Comprehensive PR Review Report

Write comprehensive PR review report as markdown file, save in `./docs/ai_generated` directory. Report includes:
- Summary of changes
- Code quality assessment
- Performance considerations
- Security implications
- Testing coverage
- Recommendations
- Whether changes ready to merge or need revisions

---

## Express / React Code Review Checklist

### Architecture & Design
- [ ] Follows standard project structure (`backend/src/`, `frontend/src/`)
- [ ] Proper separation of concerns (route vs middleware vs db; component vs hook vs context)
- [ ] Context used appropriately for global state
- [ ] Components focused with single responsibility

### TypeScript
- [ ] Explicit types instead of `any`
- [ ] Interfaces defined for props and API responses
- [ ] Proper null handling
- [ ] Type-only imports use `import type`

### Express (Backend)
- [ ] Parameterized queries only — no string concat / injection
- [ ] Transactions via `getClient()` for multi-statement mutations
- [ ] No swallowed exceptions (empty catch blocks)
- [ ] Server-side timing via PostgreSQL `NOW()`
- [ ] No `console.log` — logging via `utils/logger.ts`
- [ ] `correct_opt` never exposed to the client
- [ ] Validation at the route edge
- [ ] JWT verify middleware on protected routes; deadline middleware applied

### React (Frontend)
- [ ] Functional components with hooks
- [ ] Custom hooks for reusable logic
- [ ] No unnecessary re-renders (`useMemo`/`useCallback` where measured)
- [ ] Context used appropriately for global state
- [ ] Tailwind utilities + theme tokens (no stray inline styles, no magic values)
- [ ] Route order correct (`/quiz/complete` before `/quiz/:sequence`)

### Error Handling
- [ ] `try/catch` for async operations
- [ ] React error boundaries
- [ ] Consistent backend error envelope
- [ ] API errors handled gracefully (`ApiError`/`EventConcludedError`)
- [ ] Meaningful error messages

### Security
- [ ] No secrets in code — all via env vars
- [ ] Input validation server-side
- [ ] Google ID token verified server-side; JWT handled securely; never logged
- [ ] CORS configured explicitly (frontend URL only)
- [ ] `correct_opt` not leaked

### Performance
- [ ] No unnecessary re-renders (frontend)
- [ ] No N+1-style query patterns (backend)
- [ ] Lazy loading for routes (`React.lazy`) where appropriate
- [ ] Database indexes for new query/filter columns

### Testing
- [ ] Backend tests present (Vitest + supertest)
- [ ] Frontend tests use Vitest + Testing Library + MSW
- [ ] Error cases covered
- [ ] Mocks appropriate

### Code Quality
- [ ] Follows naming conventions
- [ ] Proper import organization
- [ ] No magic numbers — constants defined
- [ ] Early returns to reduce nesting
- [ ] Commit messages follow `NANO-<id>: <subject>` convention