# Clarification Questions — Batch 01

> **How to answer:** write your reply on the line(s) directly under each **Answer:**.
> Multiple-choice: mark your pick (or write your own). Boolean: write `yes` / `no`.
> When done, reply in the thread (e.g. *"answered batch 01"*) or re-run `/product-management`.

## Topic: Result screen shape (F-07)

### Q1. Should the result be a dedicated Completion page/route, or stay inline in QuizPlay?

**Type:** multiple-choice · **Why this matters:** determines routing work, shareability of the result URL, and how much of QuizPlay gets refactored.

- ( ) **A. Dedicated route `/quizzes/:id/completion`** *(recommended)* — matches the planned project structure (pages list includes Completion), gives a stable post-quiz destination, and cleanly separates play state from result state.
- ( ) B. Keep inline in QuizPlay, enriched with duration + leaderboard link — less work, no refactor, but no shareable/reloadable result destination.

**Answer:** A

---

### Q2. The leaderboard itself doesn't exist yet as a page (only the backend endpoint). How should F-07's "link to the quiz's leaderboard" be scoped?

**Type:** multiple-choice · **Why this matters:** decides whether this cycle ships a minimal leaderboard page or defers it to the leaderboard feature.

- ( ) **A. Link to `/quizzes/:id/leaderboard` now, with a minimal leaderboard page (fetch + list) so the link isn't dead** *(recommended)* — satisfies the F-07 acceptance criterion end-to-end without gold-plating.
- ( ) B. Render the link pointing at the future route but add the page later — link would 404/catch-all until the leaderboard feature lands.
- ( ) C. Omit the link for now; add it in the leaderboard feature — F-07 criterion stays partially unmet this cycle.

**Answer:** A

---

## Topic: Timer behavior details (F-05)

### Q3. When a question times out, how should the unanswered question be recorded in the answers array sent to submit?

**Type:** multiple-choice · **Why this matters:** the submit payload's `answers: number[]` must stay well-defined; backend scoring must handle it consistently.

- ( ) **A. Record a sentinel value (e.g. `-1`) for timed-out questions** *(recommended)* — preserves answer-to-question position, and the backend already scores server-side; scoring treats non-option values as incorrect. Needs a small backend check that `-1` is accepted/validated as incorrect.
- ( ) B. Record `0` (no option selected) — reuses existing option-index space but could collide with a real "option 0" depending on indexing convention.
- ( ) C. Omit the entry (shorter array) — breaks positional mapping; risky.

**Answer:** A

---

### Q4. Should the countdown pause/stop while a submit retry is pending (i.e. after the last question ended)?

**Type:** boolean · **Why this matters:** edge-case polish; once the quiz ends the timer is irrelevant, but on retry waits the countdown must not keep firing.

**Answer:** Yes, and while retrying, it should show a loader.

---
