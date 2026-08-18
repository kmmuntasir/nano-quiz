# Clarification Questions — Batch 01

> **How to answer:** write your reply on the line(s) directly under each **Answer:**.
> Multiple-choice: mark your pick (or write your own). Boolean: write `yes` / `no`.
> When done, reply in the thread (e.g. *"answered batch 01"*) or re-run `/product-management`.

## Topic: F-04 end-of-quiz boundary

### Q1. When the participant answers the LAST question, what should F-04 ship, given the submit endpoint (scoring) is not part of F-04?

**Type:** multiple-choice · **Why this matters:** defines what DEL-01 must build at the flow's end so F-04 is a coherent, shippable unit without pulling in scoring.

- ( ) **A. Collect answers in memory + minimal submit call** *(recommended)* — F-04 accumulates `answers[]` in memory and on the last answer calls `POST /api/quizzes/:id/submit` (built as part of F-04 with server-side scoring), landing on a minimal completion screen ("You scored X of Y"). The flow is complete end-to-end; timer remains F-05.
- ( ) B. Stop at a "quiz finished" placeholder — F-04 ends the question flow with a "completed, results coming" screen; submit/scoring is a later deliverable. Smaller, but the flow dead-ends.

**Answer:** A

---

## Topic: Server-side validation strictness

### Q2. Should the question-fetch endpoint validate that the client is requesting seq in order (reject a future/wrong seq), or serve any valid seq within bounds?

**Type:** multiple-choice · **Why this matters:** determines anti-cheat posture and test surface for the new endpoint.

- ( ) **A. Serve any seq within 1..questionCount after validating the seed** *(recommended)* — matches the repo rule "server serves by seq; client-enforced no-backtracking"; simplest, and no answer key is exposed either way so skipping yields no advantage.
- ( ) B. Strictly sequential — track last-served seq per seed (needs server-side session state, which conflicts with the no-mid-way-storage rule).

**Answer:** A

---

### Q3. If `seed` is missing/invalid or the quiz has no questions, should the endpoint return an error, and which?

**Type:** boolean · **Why this matters:** fixes the error contract for the new endpoint (default: `400` for missing seed, `403` with an error code like INVALID_SEED for a seed that doesn't derive a valid question set, `404` unknown quiz).

**Answer:** 400

---
