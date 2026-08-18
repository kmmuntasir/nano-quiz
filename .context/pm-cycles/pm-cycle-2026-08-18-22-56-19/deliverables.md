# NanoQuiz — Deliverables

> Source of truth for this delivery cycle. Each item is a single,
> **complete, end-to-end** deliverable — a feature, a bugfix, or an enhancement.
> No deliverable is split by layer: if a requirement touches data, APIs, and UI,
> it all ships together as one unit.
>
> Status legend: 🔴 not started · 🟡 in progress · 🟢 done. All items 🔴 unless marked.

---

## Table of Contents
1. Context & Locked Decisions
2. Glossary
3. Deliverables Index
4. Dependency Graph & Suggested Phasing
5. Cross-Cutting Concerns

---

## Context & Locked Decisions

**Scope reality (from codebase audit):**
- F-08 backend and most UI already shipped in F-04..F-07: start returns `409 ALREADY_PARTICIPATED`; `GET /api/quizzes` includes `participated`/`userScore`/`canStart`; StartQuizButton disables with the user's score; QuizList refetches on mount, on tab visibility change, and after a failed start. What remains is **verification + regression test coverage** so the lock cannot silently regress.
- F-09 is satisfied by construction (start only mints a seed; nothing persists until submit). What remains is **verification + tests** proving abandon leaves no record and does not disable Start.
- F-10's only gap is the **pagination UI**: the API supports `page`/`pageSize` (defaults 1/20, cap 100) and returns `{ quizId, page, pageSize, total, entries }`, but the frontend always requests page 1 with no navigation controls.

**Locked decisions:**
- F-08/F-09 deliverables scope remaining verification work, not re-implementation.
- F-10 uses the existing backend contract unchanged; UI default page size 20 (assumed — override if a different size is wanted).
- No clarification batch was needed; all decisions were codebase-resolvable.

## Glossary

| Term | Meaning |
| --- | --- |
| Participation | A completed attempt: one `participations` row (user + quiz + score + duration) |
| Seed | Random hex minted at start; deterministic per-contestant question order |
| 409 ALREADY_PARTICIPATED | Server rejection of a start for a user who already completed the quiz |
| durationMs | Client-reported elapsed time, used only for leaderboard ordering |
| pageSize | Leaderboard page size: default 20, server-capped at 100 |

## Deliverables Index

| ID | Type | Title | Blocked by |
| --- | --- | --- | --- |
| [DEL-01](deliverables/DEL-01-participation-lock-verification.md) | Enhancement | Single participation lock — verification & test hardening | — |
| [DEL-02](deliverables/DEL-02-abandon-restart-verification.md) | Enhancement | Abandon & restart — verification & test hardening | — |
| [DEL-03](deliverables/DEL-03-leaderboard-pagination.md) | Feature | Leaderboard pagination UI & page navigation | — |

## Dependency Graph & Suggested Phasing

```text
DEL-01 (verify F-08)   DEL-02 (verify F-09)   DEL-03 (F-10 pagination UI)
        \                   |                      /
         \                  |                     /
          `------- all independent, any order ------'
```

**Suggested phasing**
- **Phase 1 — hardening:** DEL-01, DEL-02 (can run in parallel)
- **Phase 2 — feature completion:** DEL-03

## Cross-Cutting Concerns
- All new backend tests: HTTP-level via supertest against the app with the real schema (in-memory or seeded DB), JWT signed per test — per repo testing rules.
- All new frontend tests: Vitest + Testing Library + MSW; no real network.
- Never expose `correct_opt`, per-question correctness, or answer keys anywhere (anti-cheat).
- Error envelope discipline: 400/401/403/404/409 per the backend rules; UI surfaces messages via existing error components.
- No schema changes in this cycle; no migrations required.
