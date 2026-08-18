---
description: Deterministic batch ticket-processing pipeline. Curates a ticket list, plans each ticket, breaks it into tasks, implements (parallelizing backend + frontend when files are disjoint), verifies, and commits per ticket. Use when the user passes a file path containing multiple tickets, says "workflow"/"batch"/"unattended"/"all tickets", or wants the whole batch run autonomously.
agent: build
---

# ticket-pipeline

Run the batch ticket-processing pipeline end-to-end in the main context. You are the driver; delegate work to subagents via the `task` tool.

## Input

`$ARGUMENTS` — a path to a ticket list file, or inline ticket text.

## Stages (per ticket)

Execute deterministically, ticket by ticket:

1. **Curate** — spawn the `analyst` subagent to read the ticket list and return a structured list: per ticket, `{ id, title, layer (backend|frontend|fullstack|other), files (best guess), criteria, deps }`. Resolve obvious scope questions by inspecting the codebase; strip anything needing a human decision.
2. **Plan** — spawn the `analyst` (or `general`) subagent to produce an implementation plan following `.claude/skills/create-implementation-plan/SKILL.md`: `{ summary, approach, risks, filesTouched, openQuestions }`.
3. **Breakdown** — spawn a subagent to convert the plan into small parallelizable tasks per `.claude/skills/breakdown-plan-into-tasks/SKILL.md`: `{ tasks: [{ id, title, layer, files, criteria, deps }] }`.
4. **Implement** — dispatch `express-coder` for backend tasks and `react-coder` for frontend tasks via the `task` tool (`subagent_type: "express-coder"` / `"react-coder"`). Run backend + frontend **in parallel only when files are disjoint** (no shared file between layers); otherwise sequential. One task per coder invocation. Pass the full task context: description, acceptance criteria, references, ticket id.
5. **Verify** — spawn a subagent to check implementation against the breakdown per `.claude/skills/verify-implementation/SKILL.md`: `{ verified: boolean, gaps: [...], notes, filesTouched }`. `verified=false` if ANY acceptance criterion is unmet.
6. **Commit** — spawn the `committer` subagent (`subagent_type: "committer"`) to stage exactly the changed files (from verification `filesTouched`) and commit with the project convention `NANO-<id>: <subject>` (or `feat:`/`fix:`/etc. prefix when no ticket id). NEVER push, merge, rebase, amend, or force. Never `git add .`.

## Standing approval

Invoking this command IS standing approval to commit per ticket (one commit per task/verification unit). Push/merge/rebase/amend remain the user's call.

## Project conventions (context for subagents)

- Backend: Node.js 24 + Express.js 5 + TypeScript, route → middleware → db layering, `pg` on PostgreSQL (parameterized queries, `getClient()` transactions), Google OAuth + JWT, structured JSON logger, Vitest + supertest. Verify: `cd backend && npm run typecheck && npm test`.
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS + Context API + Axios, Vitest + Testing Library + MSW. Verify: `cd frontend && npm test`.
- No `any` in TS; no `console.log` in production paths; no string-concatenated SQL; `correct_opt` never exposed to the client; server-side timing via PostgreSQL `NOW()`.
- Commit: `NANO-<id>: <subject>`.

## Output

Return a concise per-ticket summary: ticket id/title, plan+task counts, verification result (verified or gaps), and commit hash + message. Flag any blocker or uncommitted work.