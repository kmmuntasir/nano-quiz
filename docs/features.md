# NanoQuiz — Feature Breakdown

> Living document. Breaks the PRD (`docs/PRD.md`) and API spec (`docs/api-docs/API.md`) into small, independently deliverable, user-facing features. Each feature is sized so it can be implemented, verified, and shipped on its own.

## Conventions

- **IDs** — `F-##` for contestant features, `A-##` for admin features. Stable references for plans, tickets, and commits (e.g. `NANO-123: F-04 quiz taking flow`).
- **Status** — `New` / `Planned` / `In progress` / `Done`. Update as features ship.
- **Dependencies** — features that must ship first (partially or fully). A feature can ship as soon as its dependencies are satisfied.
- **API** — endpoints the feature touches (see `docs/api-docs/API.md`).

---

## Inventory

### Contestant features

| ID | Feature | Depends on | Status |
|---|---|---|---|
| F-01 | Sign in with Google | — | Done |
| F-02 | Browse the quiz list | F-01 | Done |
| F-03 | Start gating (active window + participation) | F-02 | Done |
| F-04 | Quiz taking flow (one question at a time) | F-03 | Done |
| F-05 | Per-question timer & auto-advance | F-04 | Done |
| F-06 | Final submit & retry | F-04 | Done |
| F-07 | Score result screen | F-06 | Done |
| F-08 | Single participation lock | F-06 | Done |
| F-09 | Abandon & restart (no mid-way storage) | F-04 | Done |
| F-10 | Leaderboard view | F-01 | Done |

### Admin features

| ID | Feature | Depends on | Status |
|---|---|---|---|
| A-01 | Admin identity & gated admin UI | F-01 | Done |
| A-02 | Create a quiz | A-01 | Done |
| A-03 | Admin quiz list | A-01 | Done |
| A-04 | Question bank: add question | A-02 | Done |
| A-05 | Publish a playable quiz (questionCount vs bank) | A-02, A-04 | Done |
| A-06 | Edit a quiz | A-03, A-05 | Done |
| A-07 | Edit / delete a question | A-04 | Done |
| A-08 | Delete a quiz (cascade) | A-03 | Done |
| A-09 | Admin leaderboard (read-only) | F-10 | Done |

### Platform enablers (not user-facing, shipped inside the features above)

| Enabler | Ships inside |
|---|---|
| Google ID-token verification + app JWT (2h, `isAdmin` claim) | F-01, A-01 |
| Seed-based deterministic question order | F-04, F-06 |
| Server-side scoring — `correct_opt` never leaves the server | F-06, F-07 |
| Permanent single participation record | F-08 |
| Paginated leaderboard query (score DESC, duration ASC) | F-10, A-09 |

---

## Contestant features

### F-01 — Sign in with Google

**Value**: A participant can log in with their Google account and use the app.

**Description**: One-click Google OAuth sign-in. The Google profile name becomes the display name (no onboarding step). A signed-in user can sign out. The session lasts 2 hours (JWT expiry).

**Acceptance criteria**
- [ ] Signing in with a Google account creates the app session and stores the JWT.
- [ ] The participant's Google name is shown after login.
- [ ] Sign-out clears the session and returns to the login screen.
- [ ] An expired/invalid token signs the user out gracefully (no crash).

**API**: `POST /api/auth/google`

**Dependencies**: none.

---

### F-02 — Browse the quiz list

**Value**: A participant can see every quiz and decide which to take.

**Description**: After login, all quizzes are listed with title, description, question count, per-question time limit, active window, participation status, and their previous score if they took it. Upcoming and expired quizzes are shown, not hidden.

**Acceptance criteria**
- [ ] Every quiz appears in the list with its title, description, question count, and time limit.
- [ ] The quiz's active window and the user's participation status are visible.
- [ ] A quiz the user already completed shows their score.
- [ ] The list renders cleanly when it is empty.

**API**: `GET /api/quizzes`

**Dependencies**: F-01.

---

### F-03 — Start gating (active window + participation)

**Value**: A participant can only start a quiz that is currently open and that they haven't already taken.

**Description**: The Start button is enabled only when the current time is within the quiz's window and the user has not participated. It is disabled (with a clear reason) for upcoming, expired, and already-taken quizzes. Starting an ineligible quiz fails gracefully on the server too.

**Acceptance criteria**
- [ ] Start is enabled for quizzes within `[startAt, endAt]` the user hasn't taken.
- [ ] Start is disabled with an explanatory state for upcoming, ended, and completed quizzes.
- [ ] A forced start of an ineligible quiz returns an error (403 inactive / 409 already participated) and the UI shows it.

**API**: `GET /api/quizzes` (`canStart`), `POST /api/quizzes/:id/start`

**Dependencies**: F-02.

---

### F-04 — Quiz taking flow (one question at a time)

**Value**: A participant answers questions one at a time in a randomized, personal order.

**Description**: Starting the quiz returns a random seed; the server derives the shuffled question order from it. The participant sees one question per screen with its multiple-choice options, a progress indicator (e.g. 3 of 10), and selects an answer to advance. No backtracking — answered questions can't be revisited. The correct answer is never shown on the client.

**Acceptance criteria**
- [ ] Starting a quiz begins the flow with a question and shows total question count.
- [ ] Each screen shows one question with its options and the participant's position in the quiz.
- [ ] Selecting an answer advances to the next question; the previous one cannot be returned to.
- [ ] The order is randomized per participant (two participants get different orders).
- [ ] No request/response in this flow ever contains the correct answer.

**API**: `POST /api/quizzes/:id/start`, `GET /api/quizzes/:id/question/:seq?seed=...`

**Dependencies**: F-03.

---

### F-05 — Per-question timer & auto-advance

**Value**: Each question has a visible countdown that keeps the quiz moving.

**Description**: A per-question countdown (default 15s, configurable per quiz) is enforced client-side. On timeout the quiz auto-advances to the next question — and on the last question, timeout ends the quiz and proceeds to submit. Elapsed time is tracked client-side for the final submit.

**Acceptance criteria**
- [ ] A visible countdown appears on each question and uses the quiz's configured time limit.
- [ ] On timeout the quiz advances to the next question automatically (or ends on the last question).
- [ ] Elapsed time measured client-side is carried through to the final submit.

**API**: none (client-side); uses `timeLimitSeconds` from start/quiz data.

**Dependencies**: F-04.

---

### F-06 — Final submit & retry

**Value**: A participant completes the quiz with a single reliable submit.

**Description**: On the final question (answered or timed out) the client submits all answers plus the reported elapsed time in one call. If the call fails, a manual retry button lets the participant resubmit without losing progress. The submit is idempotent — resubmitting returns the stored result.

**Acceptance criteria**
- [ ] The final answer (or timeout) triggers a single submit containing the seed, the answers array, and `elapsedMs`.
- [ ] A failed submit shows a retry button; retrying resubmits the same answers and succeeds.
- [ ] The server scores server-side; the response contains the score but never the correct answers.
- [ ] Resubmitting an already-completed quiz returns the stored result instead of double-scoring.

**API**: `POST /api/quizzes/:id/submit`

**Dependencies**: F-04.

---

### F-07 — Score result screen

**Value**: A participant sees their result immediately after finishing.

**Description**: After a successful submit, a result screen shows the score (e.g. 8 of 10) and total time taken. Correct answers are never revealed.

**Acceptance criteria**
- [ ] After submit, the participant sees their score and question total.
- [ ] The total duration is shown.
- [ ] No correct-answer key or per-question breakdown is displayed.
- [ ] The result screen can link to the quiz's leaderboard.

**API**: `POST /api/quizzes/:id/submit` (response)

**Dependencies**: F-06.

---

### F-08 — Single participation lock

**Value**: Each participant gets exactly one attempt per quiz.

**Description**: A completed attempt permanently disables the Start button for that user+quiz. The quiz list reflects participation and shows the participant's score. Restarting an already-completed quiz from the list is impossible.

**Acceptance criteria**
- [ ] After finishing a quiz, Start is permanently disabled for that quiz.
- [ ] The quiz list shows the quiz as participated with the user's score.
- [ ] Forcing a start on a completed quiz returns 409 and the UI surfaces it.

**API**: `GET /api/quizzes` (`participated`, `userScore`), `POST /api/quizzes/:id/start`

**Dependencies**: F-06.

---

### F-09 — Abandon & restart (no mid-way storage)

**Value**: Leaving mid-quiz leaves no trace and costs nothing.

**Description**: Nothing is persisted until the final submit. A participant who closes the tab or navigates away abandons the attempt; no record exists. On returning they restart from the beginning (a fresh seed/order).

**Acceptance criteria**
- [ ] Closing the tab mid-quiz leaves no attempt record (nothing appears on the leaderboard or participation state).
- [ ] Returning to the app, the quiz is startable again from question 1.
- [ ] A started-but-unsubmitted quiz never disables Start for that user.

**API**: none beyond existing start/submit behavior.

**Dependencies**: F-04.

---

### F-10 — Leaderboard view

**Value**: A participant can see how they rank against others on a quiz.

**Description**: Each quiz has a paginated leaderboard showing rank, Google profile name, score, and total time taken, ranked score DESC, duration ASC. The participant can browse pages.

**Acceptance criteria**
- [ ] The leaderboard lists ranked entries with name, score, and duration.
- [ ] Ordering is score descending, then duration ascending.
- [ ] Large leaderboards paginate (page / page size) with working page navigation.
- [ ] The leaderboard is accessible from a quiz's page/result screen.

**API**: `GET /api/quizzes/:id/leaderboard?page=&pageSize=`

**Dependencies**: F-01.

---

## Admin features

### A-01 — Admin identity & gated admin UI

**Value**: Designated admins get admin tools; everyone else never sees them.

**Description**: Admins are identified by `ADMIN_EMAILS` (comma-separated env var), checked live on each request. Signing in as an admin sets `isAdmin` in the JWT, which drives an admin section/links in the UI. Non-admins see no admin UI at all. The server-side `require-admin` check is the real security boundary.

**Acceptance criteria**
- [ ] An email in `ADMIN_EMAILS` signs in with admin access; all others don't.
- [ ] Admin UI/navigation is entirely hidden from non-admins.
- [ ] Admin API calls without a valid `isAdmin` token are rejected server-side (403).
- [ ] Changing `ADMIN_EMAILS` takes effect on the next request (checked live).

**API**: `POST /api/auth/google` (`isAdmin`), admin middleware

**Dependencies**: F-01.

---

### A-02 — Create a quiz

**Value**: An admin can create a new quiz.

**Description**: Create a quiz with a title, description, per-question time limit, active window (start/end), and target question count. Validation: `endAt` after `startAt`, positive `questionCount`. A quiz isn't playable until it has enough questions in its bank (see A-05).

**Acceptance criteria**
- [ ] An admin can create a quiz with all settings and see it in the admin list.
- [ ] Invalid input is rejected with clear messages (bad dates, non-positive question count).
- [ ] The created quiz appears in the participant quiz list (F-02).

**API**: `POST /api/admin/quizzes`

**Dependencies**: A-01.

---

### A-03 — Admin quiz list

**Value**: An admin can see all quizzes and their usage at a glance.

**Description**: The admin list shows each quiz's settings plus question bank size and attempt count, which drive whether a quiz is editable.

**Acceptance criteria**
- [ ] The admin list shows every quiz with title, settings, bank size, and attempt count.
- [ ] Attempt count reflects real submissions (grows after F-06 submits).
- [ ] The list marks whether a quiz can still be edited (no attempts yet).

**API**: `GET /api/admin/quizzes`

**Dependencies**: A-01.

---

### A-04 — Question bank: add question

**Value**: An admin can add multiple-choice questions to a quiz.

**Description**: Add a question with text, options (plural), and the correct option. Admin sees and sets the correct answer; it stays server-side only. Repeated additions build the bank a quiz draws from.

**Acceptance criteria**
- [ ] An admin can add a question with its options and correct answer.
- [ ] The new question appears in the admin question list with its correct answer visible to admins.
- [ ] Invalid input (e.g. too few options, missing correct opt) is rejected.
- [ ] The correct answer never leaks to any contestant endpoint.

**API**: `POST /api/admin/quizzes/:id/questions`, `GET /api/admin/quizzes/:id/questions`

**Dependencies**: A-02.

---

### A-05 — Publish a playable quiz (questionCount vs bank)

**Value**: An admin can make a quiz ready for participants.

**Description**: A quiz's `questionCount` (how many randomized questions each contestant gets) cannot exceed the question bank size, validated on save. Shipping this ensures a quiz can only be published once its bank is big enough — the admin adds questions, then sets/adjusts `questionCount` accordingly.

**Acceptance criteria**
- [ ] Saving a `questionCount` larger than the current bank size is rejected with a clear message.
- [ ] Once the bank size meets `questionCount`, the quiz is startable by participants (F-03).
- [ ] The admin UI surfaces the relationship (e.g. shows bank size vs. question count).

**API**: `POST /api/admin/quizzes` / `PUT /api/admin/quizzes/:id` (validation)

**Dependencies**: A-02, A-04.

---

### A-06 — Edit a quiz

**Value**: An admin can update quiz settings before anyone has attempted it.

**Description**: All quiz settings are editable until the quiz has its first attempt. Once any attempt exists, editing is blocked (409) — content is frozen to keep scoring fair.

**Acceptance criteria**
- [ ] An admin can edit title, description, time limit, window, and question count on an unattempted quiz.
- [ ] Editing a quiz with at least one attempt is blocked with a clear error.
- [ ] `questionCount` edits respect the bank-size validation from A-05.

**API**: `PUT /api/admin/quizzes/:id`

**Dependencies**: A-03, A-05.

---

### A-07 — Edit / delete a question

**Value**: An admin can fix or remove questions before a quiz is attempted.

**Description**: Question text, options, and correct answer can be edited; questions can be deleted. Both are blocked once the quiz has any attempt (deleting would break the active question set).

**Acceptance criteria**
- [ ] An admin can edit a question's text, options, and correct answer.
- [ ] An admin can delete a question from the bank.
- [ ] Edit/delete on a quiz with at least one attempt is blocked with a clear error.

**API**: `PUT /api/admin/quizzes/:id/questions/:questionId`, `DELETE /api/admin/quizzes/:id/questions/:questionId`

**Dependencies**: A-04.

---

### A-08 — Delete a quiz (cascade)

**Value**: An admin can remove a quiz and all its data.

**Description**: Deleting a quiz removes it, its question bank, attempts, and leaderboard entries in one operation. Allowed regardless of attempts (unlike edit).

**Acceptance criteria**
- [ ] Deleting a quiz removes it from admin and participant lists.
- [ ] Its questions, attempts, and leaderboard entries are removed (nothing orphaned).
- [ ] Deletion works even when the quiz has attempts.

**API**: `DELETE /api/admin/quizzes/:id`

**Dependencies**: A-03.

---

### A-09 — Admin leaderboard (read-only)

**Value**: An admin can review a quiz's results without changing them.

**Description**: The admin leaderboard is the same paginated view as F-10. No modification endpoints exist.

**Acceptance criteria**
- [ ] An admin can open the same paginated leaderboard for any quiz.
- [ ] No admin action can modify leaderboard entries.

**API**: `GET /api/admin/quizzes/:id/leaderboard`

**Dependencies**: F-10.