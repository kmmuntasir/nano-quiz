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

All contestant features (F-01..F-10) are done and merged. This cycle delivers the entire admin surface (A-01..A-09).

- **Admin API contract** follows `docs/api-docs/API.md` `/api/admin/*` exactly — no new shapes invented.
- **Security boundary**: `require-admin` middleware (checks `isAdmin` JWT claim) is the real boundary; hiding the admin UI is cosmetic only.
- **Identity**: admins are identified at login via `ADMIN_EMAILS` env; `isAdmin` rides in the 2h JWT. No separate login flow.
- **Answer-key discipline**: `correct_opt` is returned only by admin question endpoints (`GET /api/admin/quizzes/:id/questions`); never on contestant endpoints (`GET /api/quizzes/:id/question/:seq`).
- **Edit blocking**: once a quiz has any attempt (participation), quiz edits and question edits/deletes return `409`.
- **Delete always allowed**: deleting a quiz cascades to questions, participations, and leaderboard entries, even with attempts.
- **Publish gating**: `question_count` ≤ question-bank size is validated at create and edit (400/409 per API spec); quiz startable only once bank ≥ questionCount.
- **Admin UI**: lazy-loaded `/admin` routes behind `ProtectedRoute requireAdmin`; admin nav link rendered only when `isAdmin` (assumed — override if wrong).

## Glossary

| Term | Meaning |
| --- | --- |
| Attempt | A completed participation row (user + quiz) |
| Bank size | Number of questions in a quiz's question bank |
| questionCount | Number of questions served per attempt, drawn from the bank via seeded shuffle |
| Editable | Quiz has zero attempts; settings and questions may still change |

## Deliverables Index

| ID | Type | Title | Blocked by |
| --- | --- | --- | --- |
| [DEL-01](deliverables/DEL-01-admin-foundation.md) | Feature | Admin auth foundation & gated admin UI shell | — |
| [DEL-02](deliverables/DEL-02-quiz-crud.md) | Feature | Admin quiz CRUD — create, list, edit, delete (cascade) | DEL-01 |
| [DEL-03](deliverables/DEL-03-question-bank.md) | Feature | Question bank management & publish gating | DEL-02 |
| [DEL-04](deliverables/DEL-04-admin-leaderboard.md) | Feature | Admin leaderboard (read-only) | DEL-01 |

## Dependency Graph & Suggested Phasing

```text
DEL-01 (foundation: require-admin + admin shell)
├── DEL-02 (quiz CRUD)
│   └── DEL-03 (question bank + publish gating)
└── DEL-04 (admin leaderboard)
```

**Suggested phasing**
- **Phase 1 — Foundation:** DEL-01
- **Phase 2 — Core management:** DEL-02, DEL-04 (parallel)
- **Phase 3 — Content & publish:** DEL-03

## Cross-Cutting Concerns
- **No answer leakage**: `correct_opt` only via admin endpoints; verify contestant endpoints and logs stay clean in tests.
- **Validation at route edge**: all admin bodies validated (400 with error envelope); `endAt > startAt`, positive `questionCount`, ≥2 options + valid `correctOpt`.
- **Transactions**: cascade delete and multi-statement mutations wrapped in `db.transaction()` with rollback.
- **Tests**: backend supertest suites (admin + non-admin JWT, 400/401/403/404/409 paths); frontend Testing Library + MSW for admin pages.
- **Admin UI hidden from non-admins**: route guard + no admin links; middleware is the boundary.
- **Logging**: structured JSON, no payloads/PII/secrets logged.
