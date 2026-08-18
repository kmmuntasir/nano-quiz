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
| 1 | Diff analysis + architecture review | `general` |
| 2 | Stack-specific checks (Express backend + React/Tailwind frontend) | `general` |
| 3 | Test coverage assessment + code quality checklist | `general` |

**When to parallelise:** Always use parallel subagents when diff is non-trivial (more than few files). For tiny diffs (1-2 files, cosmetic changes), single-pass review fine.

**How to parallelise:** Launch all independent subagents in single message using multiple `task` tool calls. Each subagent receives diff (via `git diff`) and its specific review scope. After all subagents return, synthesize findings into final review summary (step 6).

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
- Route → middleware → db layering respected (no business logic dumped in middleware, no ad-hoc DB connections in routes)?
- Routes thin (HTTP only: parse/validate input, call db/service, shape response)?
- `db/index.ts` owns the single `better-sqlite3` connection; typed prepared statements used consistently?

**Persistence & Schema**
- **Prepared statements only** (`?` bound params) — no string-concatenated SQL (injection risk)?
- Transactions via `db.transaction()` for multi-statement mutations (quiz start, final scoring)?
- Business timestamps via the SQLite server clock; client `elapsedMs` used only for leaderboard duration?
- Schema changes reflected in `backend/src/db/`?

**Auth & Security**
- Google ID token verified server-side via `google-auth-library` (`verifyIdToken`); `aud` matches `GOOGLE_CLIENT_ID`?
- `RESTRICT_DOMAIN` enforced when set? `ADMIN_EMAILS` → `isAdmin` JWT claim at login; `require-admin` gates `/api/admin/*`?
- JWT signed/verified with `JWT_SECRET`; `expiresIn: '2h'` carrying `userId` + `isAdmin`; middleware attaches both?
- **`correct_opt` never sent to the client** — scoring server-side on final submit only?
- CORS restricted to `FRONTEND_URL` (no `*` in prod)? Quiz active window enforced on start (in-flight attempts continue past end_at)?
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
- localStorage persistence handled cleanly (token/isAdmin persisted; no stale-closure bugs)?

**Hooks**
- Custom hooks extracted for reusable logic (`useAuth`, `useQuizTimer`)?
- `useEffect`/`useMemo`/`useCallback` dependencies correct? Cleanup for timers (client-side per-quiz countdown)?

**TypeScript**
- Explicit types instead of `any` (use `unknown` when truly unknown)?
- Interfaces/types defined for props and API responses, matching backend payloads exactly (no `correct_opt` invented)?
- Proper null handling? `import type` used for type-only imports?

**Error Handling**
- Errors caught and handled appropriately? `async`/`await` wrapped in `try/catch`?
- API errors surfaced via `ApiError`; final submit has a retry mechanism (auto-retry + manual retry button)?
- React error boundaries for component crashes?

**Component Design**
- Components focused (single responsibility)? Prop drilling avoided (use Context)?
- Functional components with hooks only?

**Routing**
- Admin routes gated by `isAdmin` (from `AuthContext`); admin UI hidden entirely from non-admins?
- Lazy-loaded routes with Suspense + ErrorBoundary? `ProtectedRoute` gates applied (`requireAuth`/`requireAdmin`)?

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
- Error cases covered alongside happy paths (400/401/403/404/409, quiz inactive, already-participated, wrong seed)?
- Mocks appropriate (`vi.fn()` / MSW for frontend; in-memory SQLite `:memory:` or db-module stubs for backend)?
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
- [ ] Prepared statements only — no string concat / injection
- [ ] Transactions via `db.transaction()` for multi-statement mutations
- [ ] No swallowed exceptions (empty catch blocks)
- [ ] Server clock for business timestamps; client `elapsedMs` only for leaderboard duration
- [ ] No `console.log` — logging via `utils/logger.ts`
- [ ] `correct_opt` never exposed to the client; scoring server-side on final submit
- [ ] Validation at the route edge
- [ ] JWT verify middleware on protected routes; `require-admin` gates `/api/admin/*`
- [ ] No mid-way storage — only the final submit persists; single participation enforced

### React (Frontend)
- [ ] Functional components with hooks
- [ ] Custom hooks for reusable logic
- [ ] No unnecessary re-renders (`useMemo`/`useCallback` where measured)
- [ ] Context used appropriately for global state
- [ ] Tailwind utilities + theme tokens (no stray inline styles, no magic values)
- [ ] Admin routes gated by `isAdmin`; admin UI hidden from non-admins
- [ ] Seed sent with each question fetch; client-side timer with auto-advance; final submit retry mechanism

### Error Handling
- [ ] `try/catch` for async operations
- [ ] React error boundaries
- [ ] Consistent backend error envelope
- [ ] API errors handled gracefully (`ApiError`); final submit retry mechanism present
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