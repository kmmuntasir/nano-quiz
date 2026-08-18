# NanoQuiz — Deliverables (F-04 Cycle)

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

**Scope boundary**
- F-04 covers the quiz-taking flow only: seed-based shuffle, one question per screen, progress indicator, no backtracking, no answer leakage.
- Per-question timer / auto-advance (F-05) and leaderboard/rich completion UX are separate later features — excluded.
- End-of-quiz behavior (owner decision, batch 01 Q1): F-04 includes the submit call with server-side scoring and a minimal "You scored X of Y" completion screen, so the flow is complete end-to-end without the timer.

**Server-side behavior**
- Question fetch serves any `seq` within `1..questionCount` after validating the seed; no server-side visit-order tracking (client-enforced no-backtracking; skipping yields no advantage since no answer key is exposed).
- Missing/malformed seed or seq → `400` (owner decision, batch 01 Q3); unknown quiz → `404`; seed that fails to derive a valid set → `403 INVALID_SEED`.
- Shuffle: seeded PRNG (mulberry32) + Fisher-Yates over the quiz's question IDs, derived from the start-returned `seed` (assumed default, matches backend rules).
- In-flight attempts continue past `end_at` — question fetch does not reject on window expiry.

**Anti-cheat invariants (from repo security rules)**
- `correct_opt` (or any answer key / per-question correctness) never leaves the server in any response or log.
- Nothing persisted until final submit; completed submit writes the `participations` row (single participation, 409 on repeat).
- `elapsedMs` is used for leaderboard duration only, never correctness gating.

## Glossary

| Term | Meaning |
| --- | --- |
| seed | 10-hex-char random string returned by start; deterministically derives the per-contestant question order |
| seq | 1-based position of a question in the participant's shuffled order |
| participation | Row recording a completed attempt (user + quiz); permanently disables Start |
| no mid-way storage | No attempt state persisted before the final submit |

## Deliverables Index

| ID | Type | Title | Blocked by |
| --- | --- | --- | --- |
| [DEL-01](deliverables/DEL-01-quiz-taking-flow.md) | Feature | Quiz taking flow — one question at a time (question fetch, shuffle, submit + scoring, play UI) | — (F-03 start endpoint, already Done) |

## Dependency Graph & Suggested Phasing

```text
F-03 (Done) ──> DEL-01 ──> F-05 timer (future cycle)
```

**Suggested phasing**
- **Phase 1 — this cycle:** DEL-01 (single complete deliverable; can be implemented as one end-to-end stream: shuffle module + endpoints + play UI).
- **Future:** F-05 timer/auto-advance builds on DEL-01's QuizPlay state.

## Cross-Cutting Concerns
- Prepared statements only; multi-statement submit (scoring + participation write) in a transaction with rollback.
- Consistent error envelope `{ error, message }`; status mapping 400/401/403/404/409 per backend rules.
- No secrets/PII/JWTs/answer keys in logs; structured JSON logger.
- Tests: supertest HTTP-level (backend, incl. answer-leakage and shuffle determinism) + Testing Library/MSW (frontend, incl. submit retry).
- Frontend: shared Axios client, Tailwind utilities, typed services matching `docs/api-docs/API.md` exactly.
