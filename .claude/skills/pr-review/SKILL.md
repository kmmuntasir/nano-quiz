---
name: pr-review
description: Comprehensive React/Node.js PR review with React best practices, TypeScript, security checks, and code quality assessment. Use when user requests to review a pull request or compare branches for code review.
---

# PR Review Skill

When the user requests a **PR review** or to **compare branches**:

### Branch Defaults

- **Source branch**: The current local branch. Determine with `git branch --show-current`.
- **Target branch**: `main`, unless the user explicitly specifies a different branch.
- If the user specifies both branches, use those values.

### Pre-Review: Branch Synchronisation

Before starting the review, both branches must be up-to-date and the source must be rebased onto the target (this project uses **Rebase and Merge** on GitHub).

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

**Offline mode**: If the user says **"offline"** when invoking this skill, skip steps 1-3 entirely. Only run the rebase (step 4) against the local copy of the target branch. This allows reviewing purely local state without network access.

**Conflict handling**: If the rebase in step 4 produces merge conflicts, **stop the entire review**. Abort the rebase (`git rebase --abort`), inform the user of the conflicts, and do not proceed with any review steps.

**If rebase succeeds**: Proceed to the review steps below.

### Parallel Subagent Strategy

This review can be accelerated using **up to 3 parallel subagents** (via the `Agent` tool). Instead of processing everything sequentially in the main context, split independent review tasks across subagents to save context window and speed up the process. Example parallelisation:

| Subagent | Scope | Agent Type |
|----------|-------|------------|
| 1 | Diff analysis + architecture review | `general-purpose` |
| 2 | React/TypeScript-specific checks (hooks, state, types, security) | `general-purpose` |
| 3 | Test coverage assessment + code quality checklist | `general-purpose` |

**When to parallelise:** Always use parallel subagents when the diff is non-trivial (more than a few files). For tiny diffs (1-2 files, cosmetic changes), a single-pass review is fine.

**How to parallelise:** Launch all independent subagents in a single message using multiple `Agent` tool calls. Each subagent should receive the diff (via `git diff`) and its specific review scope. After all subagents return, synthesize their findings into the final review summary (step 6).

## 1. Run Complete Diff

Compare the source branch against the target branch and analyze the **actual code changes**, not just commit messages.

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
- **Correctness**: Does the code work as intended?
- **Readability**: Is the code understandable?
- **Maintainability**: Will this be easy to modify later?
- **Architectural Alignment**: Does it follow the project's patterns?
- **Performance Implications**: Any performance concerns?
- **Security Considerations**: Any vulnerabilities?

Check whether tests adequately cover the changes.

## 4. React/TypeScript-Specific Review Items

### State Management
- Is React Query used for server state?
- Is useState used appropriately for local component state?
- Is React Context used only for global UI state (theme, auth, locale)?
- Are there unnecessary re-renders?

### Hooks
- Are custom hooks extracted for reusable logic?
- Are dependencies in useEffect/useMemo/useCallback correctly specified?
- Is there use of stale closures?

### TypeScript
- Are explicit types used instead of `any`?
- Are interfaces defined for props and API responses?
- Is proper null handling in place?

### Error Handling
- Are errors caught and handled appropriately?
- Are async/await calls wrapped in try/catch?
- Do API calls handle error responses gracefully?

### Component Design
- Are components focused (single responsibility)?
- Is props drilling avoided (use Context or composition)?
- Are components using functional components with hooks?

### Security
- Are secrets only in environment variables?
- Is input validation done on server-side?
- Are API tokens handled securely?

### API Client
- Is fetch or axios used with proper error handling?
- Are environment variables properly accessed (`import.meta.env.VITE_*` for frontend)?
- Is authentication token included in requests?

## 5. Test Coverage

- Are there tests for critical components?
- Do tests use Testing Library (`@testing-library/react`)?
- Are error cases covered alongside happy paths?
- Are mocks appropriately used (vi.fn())?

## 6. Provide Senior-Level Review Summary

Offer direct, actionable feedback:
- Call out risks
- Highlight strengths
- Suggest improvements
- Indicate whether changes are ready to merge or need revisions

## 7. Aim for Practical, High-Value Feedback

The goal is to emulate a real PR review from an experienced engineer — clear, specific, and focused on what matters.

## 8. Write a comprehensive PR review report

Write a comprehensive PR review report in a markdown file and save it in the `./docs/ai_generated` directory. The report should include:
- Summary of changes
- Code quality assessment
- Performance considerations
- Security implications
- Testing coverage
- Recommendations
- Whether changes are ready to merge or need revisions

---

## React/Node.js Code Review Checklist

### Architecture & Design
- [ ] Follows standard project structure (`frontend/src/`, `backend/src/`)
- [ ] Proper separation of concerns (components vs hooks vs utils)
- [ ] React Query used for server state
- [ ] Components focused with single responsibility

### TypeScript
- [ ] Explicit types instead of `any`
- [ ] Interfaces defined for props and API responses
- [ ] Proper null handling
- [ ] Type-only imports use `type` keyword

### React
- [ ] Functional components with hooks
- [ ] Custom hooks for reusable logic
- [ ] No unnecessary re-renders (useMemo, useCallback where needed)
- [ ] Context used appropriately for global state

### Error Handling
- [ ] try/catch for async operations
- [ ] Error boundaries for React components
- [ ] API errors handled gracefully
- [ ] Meaningful error messages

### Security
- [ ] No secrets in code — all via environment variables
- [ ] Input validation on server
- [ ] API tokens handled securely
- [ ] CORS configured properly

### Performance
- [ ] No unnecessary re-renders
- [ ] Lazy loading for routes (React.lazy)
- [ ] Optimistic updates where appropriate

### Testing
- [ ] Tests for critical components
- [ ] Testing Library used correctly
- [ ] Error cases covered
- [ ] Mocks appropriately used

### Code Quality
- [ ] Follows naming conventions
- [ ] Proper import organization
- [ ] No magic numbers — constants defined
- [ ] Early returns to reduce nesting