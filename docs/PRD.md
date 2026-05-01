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

### 4.2 Automated Seeding Script

The backend `package.json` will include a script (`npm run seed`). When executed, it will parse the JSON files, format them, and insert them into the PostgreSQL `questions` table, tagging them with the appropriate category (`faq` or `trivia`).

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
-   **Resumption:** If a user disconnects, upon re-login, the backend API `/api/quiz/status` checks the `user_sessions` table and returns the user to their first unanswered question.

### 5.4 Submission & Leaderboard

-   **Final Step:** The 10th question presents a "Submit Quiz" button instead of "Next".
-   **Clock Stop:** Clicking Submit logs the `completed_at` timestamp.
-   **Scoring:** The backend calculates the total correct answers, updates the `score` column in the `users` table, and marks the quiz status as `completed`.
-   **Leaderboard Mechanics:** Scores are ranked descending. Ties are broken by the lowest duration (`completed_at - started_at`).

## 6\. PostgreSQL Database Schema

### Table: `users`

| Column Name | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | PRIMARY KEY, Default gen_uuid | Unique user identifier. |
| `google_id` | VARCHAR(255) | UNIQUE, NOT NULL | Extracted from Google OAuth sub claim. |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | User's email. |
| `name` | VARCHAR(255) | NOT NULL | User's display name. |
| `employee_id` | VARCHAR(100) | UNIQUE, NULLABLE | Filled during onboarding. |
| `started_at` | TIMESTAMPTZ | NULL | Server time when quiz begins. |
| `completed_at` | TIMESTAMPTZ | NULL | Server time when final answer submitted. |
| `score` | INT | NULL | Final score (0-10). |

### Table: `questions`

| Column Name | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | PRIMARY KEY, Default gen_uuid | Unique question ID. |
| `category` | VARCHAR(50) | NOT NULL | 'faq' or 'trivia'. |
| `question_text` | TEXT | NOT NULL | The question. |
| `opt_a` | VARCHAR(255) | NOT NULL | Option A text. |
| `opt_b` | VARCHAR(255) | NOT NULL | Option B text. |
| `opt_c` | VARCHAR(255) | NOT NULL | Option C text. |
| `opt_d` | VARCHAR(255) | NOT NULL | Option D text. |
| `correct_opt` | CHAR(1) | NOT NULL | 'A', 'B', 'C', or 'D'. |

### Table: `user_sessions`

| Column Name | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | UUID | PRIMARY KEY, Default gen_uuid | Unique session row. |
| `user_id` | UUID | FOREIGN KEY (users.id) | Links to the user. |
| `question_id` | UUID | FOREIGN KEY (questions.id) | Links to the specific question. |
| `sequence_order` | INT | NOT NULL | Display order (1 through 10). |
| `user_answer` | CHAR(1) | NULL | User's submitted answer ('A', 'B', etc.). |

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
    -   **Action:** Fetches a specific question for the user based on sequence order (1-10). **Must omit the `correct_opt` field from the response payload.**
-   `POST /api/quiz/answer`
    -   **Payload:** `{ "sequence_order": 3, "answer": "C" }`
    -   **Action:** Saves the user's answer to the `user_sessions` table.
-   `POST /api/quiz/submit`
    -   **Action:** Logs `completed_at`. Calculates score by joining `user_sessions` with `questions`. Updates user `score`. Returns final confirmation (not the score).

### 7.3 Admin Routes

-   `GET /api/admin/leaderboard`
    -   **Action:** Returns the ranked list of users, sorted by `score` DESC, then by `(completed_at - started_at)` ASC.

## 8\. Environment Variables

### 8.1 Backend (.env)

```
PORT=3000
FRONTEND_URL=[https://your-app.netlify.app](https://your-app.netlify.app)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
RESTRICT_DOMAIN=exabyting.com # Leave blank to allow any Gmail
JWT_SECRET=super_secret_string_for_app_sessions
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
EVENT_DEADLINE_ISO=2024-12-31T23:59:59Z # Stops accepting submissions after this time
```

### 8.2 Frontend (.env)

```
VITE_API_BASE_URL=[https://your-api.onrender.com/api](https://your-api.onrender.com/api)
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

## 9\. Security & Edge Cases

1.  **Network Peeking Mitigation:** The API must _never_ send the `correct_opt` field to the frontend. Validation and scoring happen entirely on the server upon final submission.
2.  **Time Tampering Mitigation:** Time taken is calculated entirely via PostgreSQL functions `NOW()` upon initiation and submission. Client-side timestamps are fully ignored to prevent cheating via system clock manipulation.
3.  **Late Submissions:** Every quiz API endpoint must check the current server time against `EVENT_DEADLINE_ISO`. If the deadline has passed, the API must return `403 Forbidden` with a message "The event has concluded."
4.  **Idempotency:** The `/api/quiz/start` endpoint must verify if a user already has a `started_at` timestamp. If they do, it must abort the database write to prevent overwriting their original question set and resetting their timer.
