# Product Requirements Document (PRD)

| | |
|---|---|
| **Project Name** | OpenQuiz Plug-n-Play Application |
| **Version** | 1.0.0 |
| **Target Audience** | Engineering Teams, HR Departments, and Community Managers |
| **Platform** | Web Application (Responsive Desktop/Mobile) |
| **Architecture** | Frontend (React.js), Backend (Express.js/Node.js), Database (PostgreSQL via Supabase) |
| **Deployment** | Netlify (Frontend), Render (Backend) |

## 1\. Executive Summary

OpenQuiz is a lightweight, easily deployable, and highly configurable asynchronous quiz platform. Designed as a "plug-n-play" repository, organizations can fork the project, drop in custom JSON files containing their questions, configure environment variables for Google OAuth, and deploy a secure, timed, 10-question assessment. The system strictly limits users to a single attempt and accurately measures completion time to serve as a leaderboard tie-breaker.

## 2\. Core Objectives & Philosophy

-   **Zero-Friction Deployment:** Must require minimal code changes to launch. Configuration is handled entirely via `.env` variables and JSON seed files.
-   **Security First:** No exposed answers on the client-side. Server-side timestamping to prevent cheating. Strict Google OAuth integration.
-   **Resiliency:** The application must cache session state. If a user's browser crashes midway through the quiz, logging back in must resume their session exactly where they left off without penalty (other than the running clock).

## 3\. System Architecture

### 3.1 Tech Stack

-   **Frontend:** React.js (Vite), Tailwind CSS for styling, deployed on **Netlify**.
-   **Backend:** Node.js with Express.js REST API, deployed on **Render**.
-   **Database:** PostgreSQL, hosted on **Supabase**.
-   **Authentication:** Google OAuth 2.0 (handled via `@react-oauth/google` on the client and `google-auth-library` on the server).

### 3.2 Cross-Origin Resource Sharing (CORS)

Since the frontend and backend are deployed on different domains (Netlify vs. Render), the Express backend must be configured with strict CORS policies, only accepting requests from the specific Netlify URL defined in the environment variables.

## 4\. Plug-n-Play Configuration (Data Seeding)

Administrators configure the quiz content without touching the database directly.

### 4.1 JSON Seed Files

The backend repository will contain a `/data` directory expecting two files:

1.  `faq_questions.json` (Target: 50 questions)
2.  `trivia_questions.json` (Target: 50 questions)
**Expected JSON Schema:**

```json
[
  {
    "question": "What year was the company founded?",
    "options": {
      "A": "2018",
      "B": "2019",
      "C": "2020",
      "D": "2021"
    },
    "correct_option": "B"
  }
]
```

> **Note:** The `category` field is determined by the file name (`faq_questions.json` → `faq`, `trivia_questions.json` → `trivia`), not by a field in the JSON object. The seed script maps the nested `options` object to the database columns (`opt_a`, `opt_b`, `opt_c`, `opt_d`) and `correct_option` to `correct_opt`.

### 4.2 Automated Seeding Script

The backend `package.json` will include a script (`npm run seed`). When executed, it will parse the JSON files, format them, and insert them into the PostgreSQL `questions` table, tagging them with the appropriate category (`faq` or `trivia`). Seeding is idempotent — re-running it will skip questions that already exist (matched by category + question text).

## 5\. User Flow & Functional Requirements

### 5.1 Authentication & Onboarding

-   **Login Screen:** Users visit the Netlify URL and click "Sign in with Google."
-   **Domain Validation:** If the `.env` variable `RESTRICT_DOMAIN` is set, the backend rejects any Google tokens not matching the company domain (e.g., `@exabyting.com`).
-   **Registration:** On first successful login, users are redirected to a profile completion page to input their **Employee ID** (required).

### 5.2 Quiz Initialization

-   **Generation:** When the user clicks "Start Quiz", the backend selects 6 random questions where `category='faq'` and 4 random questions where `category='trivia'`.
-   **Session Lock:** These 10 questions are written to the `user_sessions` table, locked in a randomized order (1 to 10).
-   **Clock Start:** The backend records `started_at` using the Postgres server time.

### 5.3 Quiz Interface (Wizard/Stepper)

-   **Pagination:** Users view one question at a time.
-   **Progression:** Clicking "Next" saves the answer to the database. The frontend fetches the next question based on the sequence index.
-   **No Backtracking:** Once an answer is submitted and the user moves to the next question, previous questions cannot be revisited or altered.
-   **Sequential Access:** Users can only view the current unanswered question. The API rejects requests for any sequence other than the user's current position (first unanswered), preventing both backtracking to answered questions and jumping ahead to unanswered ones.
-   **Per-Question Timing:** When `TRACK_PER_QUESTION_TIME` is enabled, the backend records when each question is first viewed (`viewed_at`). Per-question duration is calculated as `answered_at - viewed_at`. This data is available for admin analytics but does not affect scoring or the leaderboard.
-   **Resumption:** If a user disconnects, upon re-login, the backend API `/api/quiz/status` checks the `user_sessions` table and returns the user to their first unanswered question.

### 5.4 Submission & Leaderboard

-   **Final Step:** The 10th question presents a "Submit Quiz" button instead of "Next". When the user answers the 10th question, the answer endpoint automatically logs `completed_at`, calculates the score, and marks the quiz as completed. The endpoint returns the final score to the frontend for immediate display. No separate submit endpoint exists.
-   **Scoring:** The backend calculates the total correct answers by joining `user_sessions` with `questions` and updates the `score` column in the `users` table.
-   **Leaderboard Mechanics:** Scores are ranked descending. Ties are broken by the lowest duration (`completed_at - started_at`).

## 6\. PostgreSQL Database Schema

The canonical schema is defined in [`docs/data/schema.sql`](data/schema.sql). That file contains the DDL for all three tables (`users`, `questions`, `user_sessions`) including constraints, foreign keys, and indexes.

## 7\. API Endpoint Specifications

All endpoints under `/api/*` require a Bearer token (JWT issued by the Express backend after Google OAuth validation) in the Authorization header.

### 7.1 Auth Routes

-   `POST /api/auth/google`
    -   **Payload:** `{ "token": "GOOGLE_JWT" }`
    -   **Action:** Verifies token via `google-auth-library`. Checks if user exists. If not, creates user. Issues application JWT.
    -   **Response:** JWT, User Object, Onboarding Status.
-   `POST /api/auth/onboard`
    -   **Payload:** `{ "employee_id": "EMP123" }`
    -   **Action:** Saves Employee ID to the user record.

### 7.2 Quiz Routes

-   `GET /api/quiz/status`
    -   **Action:** Checks if the user has a `started_at` timestamp. Returns their current progress (e.g., `current_sequence: 3`) or if they are already `completed`.
-   `POST /api/quiz/start`
    -   **Action:** Triggers the 10-question random allocation, writes to `user_sessions`, and records `started_at` in the database.
-   `GET /api/quiz/question/:sequence`
    -   **Action:** Fetches a specific question for the user based on sequence order (1-10). **Must omit the `correct_opt` field from the response payload.** Must enforce sequential access — reject requests where the requested sequence is not the user's current position (first unanswered question), returning `403 Forbidden`.
-   `POST /api/quiz/answer`
    -   **Payload:** `{ "sequence_order": 3, "answer": "C" }`
    -   **Action:** Saves the user's answer to the `user_sessions` table. **Must reject if an answer already exists for this sequence** (no overwriting). Records `answered_at` using PostgreSQL `NOW()`. **When `sequence_order` is 10**, this endpoint also logs `completed_at`, calculates the score by joining `user_sessions` with `questions`, updates the user's `score`, and returns a completion confirmation with the final score.

### 7.3 Leaderboard Routes

-   `GET /api/leaderboard`
    -   **Action:** Returns the ranked list of users who have completed the quiz (`completed_at IS NOT NULL`), sorted by `score` DESC, then by `(completed_at - started_at)` ASC. Users who have not completed the quiz are excluded.

## 8\. Environment Variables

### 8.1 Backend (.env)

```
PORT=3000
FRONTEND_URL=[https://your-app.netlify.app](https://your-app.netlify.app)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
RESTRICT_DOMAIN=exabyting.com # Leave blank to allow any Gmail
JWT_SECRET=super_secret_string_for_app_sessions
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
EVENT_DEADLINE_ISO=2024-12-31T23:59:59Z # Stops accepting submissions after this time. Leave blank or unset to disable deadline enforcement (quiz remains open indefinitely).
TRACK_PER_QUESTION_TIME=true # Record when each question is viewed (for per-question analytics)
```

### 8.2 Frontend (.env)

```
VITE_API_BASE_URL=[https://your-api.onrender.com/api](https://your-api.onrender.com/api)
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

## 9\. Security & Edge Cases

1.  **Network Peeking Mitigation:** The API must _never_ send the `correct_opt` field to the frontend. Validation and scoring happen entirely on the server — scoring is triggered when the 10th answer is submitted.
2.  **Time Tampering Mitigation:** Time taken is calculated entirely via PostgreSQL functions `NOW()` upon initiation and completion. Client-side timestamps are fully ignored to prevent cheating via system clock manipulation.
3.  **Late Submissions:** All quiz API endpoints (`/api/quiz/start`, `/api/quiz/question/:sequence`, `/api/quiz/answer`) except `GET /api/quiz/status` must check the current server time against `EVENT_DEADLINE_ISO`. If the deadline has passed, the API must return `403 Forbidden` with a message "The event has concluded." The status endpoint is exempt so that users who completed the quiz before the deadline can still retrieve their results (score, timestamps) afterward. The leaderboard endpoint (`GET /api/leaderboard`) and auth endpoints (`/api/auth/*`) are not subject to the deadline check.
4.  **Idempotency:** The `/api/quiz/start` endpoint must verify if a user already has a `started_at` timestamp. If they do, it must abort the database write to prevent overwriting their original question set and resetting their timer.
5.  **DB-Level Single-Attempt Constraint:** A database trigger (`prevent_multiple_quiz_attempts`) blocks inserts into `user_sessions` if the user already has 10 session rows or has `completed_at` set. This provides defense-in-depth beyond the application-level `started_at` check.
6.  **Sequential Access Enforcement:** The question fetch endpoint must reject requests for any sequence that is not the user's current first unanswered question. This prevents both backtracking and forward-jumping at the API level.
7.  **JWT Token Expiration:** Application JWTs issued after Google OAuth verification must include an `expiresIn` of **2 hours**. This window accommodates the expected quiz duration (~10–30 minutes) plus a buffer for browser crashes and session resumption, while preventing indefinite token validity. Expired tokens must return `401 Unauthorized` (handled by the JWT validation middleware).
