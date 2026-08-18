---
name: create-implementation-plan
description: Read a ticket file (bug, feature, or enhancement), analyze the codebase, and write a comprehensive implementation plan. Use when the user hands you a ticket file path and wants an implementation plan generated.
---

# Create Implementation Plan Skill

Read the provided ticket carefully, understand what needs to be delivered, analyze the codebase, then write a complete and comprehensive implementation plan as a new markdown file in the **same folder** as the ticket.

The ticket may be a **bug**, **feature**, or **enhancement** — adapt the analysis focus and plan shape to the ticket type.

## Inputs

User provides a **ticket file path**, e.g.:

- `docs/bugfix/NANO-300.md`
- `docs/feature/notification-matrix/some-ticket.md`
- Absolute or relative path to a single `*.md` ticket

If no input is provided, **ask** for the ticket file path. Do not guess.

## Execution Steps

Follow exactly, in order.

### Step 1: Read & understand the ticket

Resolve the input to an absolute path and read it **completely**. Extract and hold in context:

- **Ticket ID** (e.g., `NANO-300`) — derive from the filename or the ticket heading
- **Ticket type** — bug / feature / enhancement. Infer from content: repro steps + expected/actual → **bug**; a new capability → **feature**; a modification/tweak to something existing → **enhancement**. State the assumption explicitly.
- **What needs to be delivered** — the requirement or defect, in your own words
- **Named endpoints, entities, roles, domains** (backend / frontend)
- For bugs: the **steps to reproduce** + expected vs. actual result

State your understanding back before analyzing: "Read ticket NANO-300 (bug) — <one-line summary>. Analyzing codebase..." (swap the type and summary as appropriate).

### Step 2: Analyze the codebase

Use up to **3 parallel `analyst` subagents** (via the task tool, `subagent_type: "analyst"`) to investigate and keep the main context window clean. **The split adapts to the ticket type.**

**For a bug** — focus on the defect:

| Subagent | Responsibility |
|----------|---------------|
| **Repro path** | Trace the reproduction path end-to-end. Locate the routes/middleware/db queries named in the ticket, read the exact code path, and confirm where the buggy behavior occurs. Cite `path:line`. |
| **Root cause** | Pinpoint the defect — the missing guard / wrong branch / bad assumption, *why* it allows the bad behavior, and where the correct check belongs (respect the layered rule: route → middleware → db). |
| **Prior art & fix surface** | Map patterns to reuse: similar existing guards, the right error envelope shapes, validation, relevant test fixtures, and any frontend impact. |

**For a feature / enhancement** — focus on the design surface:

| Subagent | Responsibility |
|----------|---------------|
| **Integration points** | Where the new/changed capability plugs in: relevant routes/middleware/db helpers, the schema (`backend/src/db/`) it extends, and any new API contract. Cite `path:line`. |
| **Patterns & conventions** | Existing precedents to mirror: analogous features already implemented (routes, middleware chain, query helpers, error envelope), naming, validation, configuration via env vars. |
| **Cross-cutting & frontend** | Shared types/utilities, security/auth implications (JWT middleware, `correct_opt` never exposed, admin gating), quiz-domain constraints (no mid-way storage, seed-based shuffle, single participation, active window, no backtracking), and frontend impact (API client, hooks, components, pages, routes, contexts). |

Backend lives at `backend/src/` (Node 24 + Express 5 + TypeScript + `better-sqlite3`, schema in `src/db/`; `npm run seed` applies it idempotently). Frontend lives at `frontend/src/` (React 19 + Vite + Tailwind CSS + Context API + Axios).

Each subagent returns a **curated digest** with `path:line` evidence — not raw file dumps. Work from those digests.

If the ticket is clearly single-layer or small, drop to 1–2 subagents. Add more `analyst` calls only if a digest surfaces a new area worth a focused probe.

### Step 3: Synthesize the approach

Combine the digests into a single coherent picture:

- **Bug** → state the root cause (what + why) and the minimal, convention-correct fix set
- **Feature / enhancement** → state the design: new/changed schema, routes, middleware, db helpers, API contract, seed data, frontend pieces — and a sensible build order (schema → db helper → route/middleware → frontend)
- **Both** → list edge cases & risks (concurrency, single-attempt enforcement, sequential access, related paths needing the same change, regressions, migration concerns) and any open questions

Respect project conventions: routes handle HTTP, middleware does cross-cutting concerns, `db/index.ts` owns the `better-sqlite3` connection; prepared statements only; `correct_opt` never exposed; no mid-way storage (final submit only); seed-based question shuffle; errors via the JSON envelope.

### Step 4: Write the implementation plan

Write the plan to the **same directory as the ticket**, named `{ticket-filename}-plan.md` — e.g. ticket `docs/bugfix/NANO-300.md` → `docs/bugfix/NANO-300-plan.md`. Use the template below; include the **Root Cause** section **only for bugs**.

## Plan Template

```markdown
# Implementation Plan — {TICKET_ID}

**Ticket:** `{path-to-ticket}`
**Type:** {Bug | Feature | Enhancement}
**Title:** {ticket title}
**Generated:** {ISO date}

---

## Summary

{1–2 paragraph restatement of what needs to be delivered, in your own words.}

## Root Cause  *(bugs only — omit for feature/enhancement)*

{The precise defect: what is wrong and why it happens, with `path:line` evidence.}

## Affected Components

| Layer | File | Why |
|-------|------|-----|
| Route | `backend/src/routes/Xxx.ts` | ... |
| Middleware | `backend/src/middleware/Xxx.ts` | ... |
| DB | `backend/src/db/index.ts` | ... |
| Schema | `backend/src/db/` | ... |
| Seed | `backend/src/db/schema.ts` | ... |
| Component | `frontend/src/components/Xxx.tsx` | ... |
| ... | ... | ... |

## Proposed Implementation

{Step-by-step. One sub-section per change, each with **File** / **What** / **Why** / **Code reference** (existing method/line the change builds on). Group backend and frontend separately. For features/enhancements, order changes by build dependency.}

### Backend Changes
...

### Frontend Changes
*(only if the ticket or fix touches the frontend)*
...

## Edge Cases & Risks

- {concurrency / single-attempt / sequential access / related paths / regressions / migration concerns}

## Testing

*Follow project conventions — Vitest + supertest for the backend; Vitest + Testing Library (MSW mocks) for the frontend; one behavior per test; co-locate tests next to source.*

- **Unit tests:** {route/db-level cases}
- **HTTP tests:** {route tests via supertest}
- **Frontend tests:** {component/hook tests, MSW for API mocks}
- **Manual verification:** {re-run the ticket's reproduce steps for bugs / exercise the new capability for features}

## Acceptance Criteria

- [ ] {verifiable outcome — mirrors the ticket's "Expected Result" / acceptance criteria}
- [ ] ...

## Open Questions  *(optional)*

- {anything needing a product/owner decision}

## Out of Scope

- {anything explicitly not addressed}
```

## Error Handling

- **Can't read ticket** — ask the user to verify the path; do not proceed.
- **Ticket has no ID** — derive a slug from the filename; flag it in the plan.
- **Ticket type unclear** — state your best inference and why; proceed on that basis and note it.
- **Approach ambiguous** (e.g. unclear root cause, or a feature with multiple valid designs) — document the leading approach with evidence, list the alternatives, and mark what needs confirmation. Do not fabricate `path:line` citations.
- **Subagent failure** — retry the failed `analyst` individually; note in the plan if an area could not be fully investigated.

## Key Principles

- **Delegate analysis, write yourself.** Keep the main context clean — investigate via `analyst` subagents, synthesize and write the plan directly.
- **Evidence-backed.** Every code claim cites `path:line`. No guesses presented as fact.
- **Convention-correct.** Respect the route → middleware → db layering and the project's style/error/testing conventions; never propose exposing `correct_opt` or putting business logic in middleware.
- **Adapt to the ticket type.** Bugs hunt a root cause; features/enhancements lay out a design. Same plan skeleton, type-appropriate emphasis.
- **Comprehensive but minimal.** Cover the full surface (including related paths needing the same change) without scope creep. Out-of-scope items are called out explicitly.
