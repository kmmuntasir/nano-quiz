# Frontend Task Breakdown Documentation

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Project Setup](#phase-1-project-setup)
3. [Phase 2: Authentication](#phase-2-authentication)
4. [Phase 3: Quiz Interface](#phase-3-quiz-interface)
5. [Phase 4: Leaderboard](#phase-4-leaderboard)
6. [Phase 5: Integration](#phase-5-integration)
7. [Phase 6: Testing](#phase-6-testing)
8. [Dependencies Matrix](#dependencies-matrix)

---

## Overview

This document outlines the complete task breakdown for building the OpenQuiz frontend. The frontend is a React.js application built with Vite and styled with Tailwind CSS.

| Attribute | Value |
|-----------|-------|
| **Framework** | React.js (Vite) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Auth** | @react-oauth/google |
| **Deployment** | Netlify |

### Reference: PRD Sections

- **5.1** Authentication & Onboarding
- **5.2** Quiz Initialization
- **5.3** Quiz Interface (Wizard/Stepper)
- **5.4** Submission & Leaderboard
- **8.2** Frontend Environment Variables

### Phase Summary

| Phase | # Tasks | Description |
|-------|--------|------------|
| 1 | 3 | Project init, routing, API client |
| 2 | 2 | Google login, onboarding |
| 3 | 4 | Quiz wizard, question display, answer submission, completion |
| 4 | 2 | Leaderboard view, refresh |
| 5 | 2 | Error handling, deployment |
| 6 | 3 | Testing |

---

## Phase 1: Project Setup

### T1: Initialize React Project with Vite and TypeScript

**Description:**

Initialize the frontend project with React.js, Vite, and TypeScript. Install all required dependencies and configure the build tools.

**Dependencies:**

- None

**Acceptance Criteria:**

- [ ] Project created with `npm create vite@latest`
- [ ] TypeScript is configured
- [ ] Tailwind CSS is installed and configured
- [ ] `npm run dev` starts development server
- [ ] `npm run build` produces production build

**Required Dependencies:**

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "@react-oauth/google": "^4.x",
    "axios": "^1.x"
  },
  "devDependencies": {
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "@vitejs/plugin-react": "^4.x",
    "typescript": "^5.x",
    "vite": "^5.x",
    "tailwindcss": "^3.x",
    "postcss": "^8.x",
    "autoprefixer": "^10.x"
  }
}
```

---

### T2: Configure Routing

**Description:**

Set up React Router with all required routes for the application.

**Dependencies:**

- T1

**Acceptance Criteria:**

- [ ] Routes are defined for all pages
- [ ] Protected routes require authentication
- [ ] Lazy loading is implemented for code splitting

**Route Structure:**

| Path | Component | Access | Description |
|------|-----------|--------|------------|
| `/` | Home | Public | Landing/Login page |
| `/onboard` | Onboarding | Auth + No Employee ID | Employee ID input |
| `/quiz` | Quiz | Auth + Has Employee ID | Quiz container |
| `/quiz/complete` | Completion | Auth + Quiz Completed | Score display and leaderboard link |
| `/quiz/:sequence` | Question | Auth + Quiz Started | Individual question |
| `/leaderboard` | Leaderboard | Auth | Score rankings |

**Important:** Define `/quiz/complete` **before** `/quiz/:sequence` in the route config. React Router matches top-to-bottom — if `:sequence` comes first, it will capture `complete` as a sequence value.

---

### T3: Set Up API Client

**Description:**

Create a centralized API client using Axios with interceptors for authentication and error handling.

**Dependencies:**

- T1

**Acceptance Criteria:**

- [ ] Axios instance configured with base URL from `VITE_API_BASE_URL`
- [ ] Request interceptor attaches Bearer token
- [ ] Response interceptor handles 401/403 errors
- [ ] Global error handler displays user-friendly messages
- [ ] React Context for auth state is created (`AuthContext`) tracking user, token, and onboarding status
- [ ] `useAuth()` hook exposes `user`, `token`, `isAuthenticated`, `login()`, `logout()` methods
- [ ] Auth state is persisted in localStorage, rehydrated on app load, and quiz resumes from last unanswered question via `GET /api/quiz/status`

**Implementation Notes:**

```typescript
// src/api/client.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
```

**Auth Context Implementation:**

```typescript
// src/context/AuthContext.tsx
// Provides: user, token, isAuthenticated, login(), logout(), hasOnboarded()
// Persists token in localStorage, rehydrates on mount
```

---

## Phase 2: Authentication

### T4: Implement Login Page with Google OAuth

**Description:**

Create the login page with Google OAuth button using `@react-oauth/google`.

**Dependencies:**

- T3

**Acceptance Criteria:**

- [ ] Google OAuth button is displayed
- [ ] `GoogleOAuthProvider` from `@react-oauth/google` wraps the app at root level with `VITE_GOOGLE_CLIENT_ID`
- [ ] Clicking triggers Google popup
- [ ] Google JWT is sent to `POST /api/auth/google`
- [ ] On success: stores JWT in localStorage via `AuthContext`
- [ ] On success: redirects to `/onboard` or `/quiz` based on onboarding status

**PRD Reference:** Section 5.1, 7.1

**User Flow:**

```
[Login Page] → [Google Popup] → [Submit to Backend] → [Store Token] → [Redirect]
```

---

### T5: Implement Onboarding Page

**Description:**

Create the onboarding page for first-time users to input their Employee ID.

**Dependencies:**

- T4

**Acceptance Criteria:**

- [ ] Displays welcome message with user's name
- [ ] Input field for Employee ID (required)
- [ ] Validates Employee ID is not empty
- [ ] Submits to `POST /api/auth/onboard`
- [ ] Redirects to `/quiz` on success

**PRD Reference:** Section 5.1

**Response Handler:**

```typescript
const handleOnboard = async (employeeId: string) => {
  await api.post('/auth/onboard', { employee_id: employeeId });
  navigate('/quiz');
};
```

---

## Phase 3: Quiz Interface

### T6: Implement Quiz Container

**Description:**

Create the quiz container that manages the overall quiz state and progression.

**Dependencies:**

- T3

**Acceptance Criteria:**

- [ ] Fetches quiz status on mount via `GET /api/quiz/status`
- [ ] Handles three states:
  - **Not started:** Shows "Start Quiz" button
  - **In progress:** Redirects to current question sequence
  - **Completed:** Shows completion message or leaderboard link

**PRD Reference:** Section 5.2, 7.2

**State Handling:**

```typescript
// Quiz status response types
interface QuizStatus {
  started: boolean;
  completed: boolean;
  current_sequence?: number;
  started_at?: string;
  score?: number;
  completed_at?: string;
  duration_seconds?: number;
}
```
// Logic:
// if (!started) → Show StartButton
// if (started && !completed) → Navigate to /quiz/current_sequence
// if (completed) → Show completion message
```

---

### T7: Implement Start Quiz Button

**Description:**

Create the "Start Quiz" button component that triggers quiz initialization.

**Dependencies:**

- T6

**Acceptance Criteria:**

- [ ] Button visible when quiz not started
- [ ] Clicking calls `POST /api/quiz/start`
- [ ] Shows loading state during API call
- [ ] Redirects to first question on success

---

### T8: Implement Question Display Component

**Description:**

Create the question display component showing one question at a time with answer options.

**Dependencies:**

- T6

**Acceptance Criteria:**

- [ ] Fetches question via `GET /api/quiz/question/:sequence`
- [ ] Displays question text
- [ ] Displays 4 answer options (A, B, C, D) as selectable buttons
- [ ] Shows progress indicator (e.g., "Question 3 of 10")
- [ ] Shows "Next" button (or "Submit" on question 10)

**PRD Reference:** Section 5.3

**Response Data:**

```json
{
  "sequence_order": 3,
  "question": "What year was the company founded?",
  "options": {
    "A": "2018",
    "B": "2019",
    "C": "2020",
    "D": "2021"
  }
}
```

---

### T9: Implement Answer Submission

**Description:**

Create the answer submission logic that saves the user's answer and advances to the next question. For questions 1–9, the answer is saved and the next question is fetched. For question 10, the answer endpoint also finalizes the quiz (scores, stops timer) — no separate submit call is needed.

**Dependencies:**

- T8

**Acceptance Criteria:**

- [ ] User selects an answer option
- [ ] Clicking "Next" (Q1–Q9) or "Submit" (Q10) calls `POST /api/quiz/answer`
- [ ] Payload: `{ sequence_order: 3, answer: "C" }`
- [ ] On success for Q1–Q9: navigates to next question via `GET /api/quiz/question/:next`
- [ ] On success for Q10: navigates to completion screen (quiz is finalized by the answer endpoint)

**PRD Reference:** Section 5.3, 5.4

**Edge Case:** No backtracking - once answer is submitted, user cannot return to previous question.

---

### T10: Implement Quiz Completion Screen

**Description:**

Create the completion screen shown after answering question 10. The answer endpoint finalizes the quiz and returns the final score — this screen displays it to the user.

**Dependencies:**

- T9

**Acceptance Criteria:**

- [ ] Triggered after Q10 answer submission succeeds, navigates to `/quiz/complete`
- [ ] Displays the final score returned by the answer endpoint (e.g., "You scored 8 out of 10!")
- [ ] Shows confirmation message
- [ ] Provides link to leaderboard
- [ ] No option to retake quiz (PRD: strictly single attempt)
- [ ] **Score data source:** On direct navigation (e.g., page refresh), fetch score from `GET /api/quiz/status` which returns `score` and `completed_at` when the quiz is completed. On navigation from Q10 answer, prefer the answer response payload (via React Router state) for instant display, falling back to the status endpoint if state is missing.

**PRD Reference:** Section 5.4

---

## Phase 4: Leaderboard

### T11: Implement Leaderboard Page

**Description:**

Create the leaderboard page displaying ranked user scores.

**Dependencies:**

- T3

**Acceptance Criteria:**

- [ ] Fetches data via `GET /api/leaderboard`
- [ ] Displays ranked list sorted by score DESC
- [ ] Shows user name, score, and duration
- [ ] **Note:** `duration_seconds` is calculated by the backend as `(completed_at - started_at)`
- [ ] Highlights current user's row
- [ ] Handles empty state (no scores yet)

**PRD Reference:** Section 5.4, 7.3

**Response Data:**

```json
[
  {
    "rank": 1,
    "name": "John Doe",
    "employee_id": "EMP123",
    "score": 10,
    "duration_seconds": 245
  }
]
```

---

### T12: Implement Auto-Refresh

**Description:**

Implement periodic refresh for the leaderboard to show live updates.

**Dependencies:**

- T11

**Acceptance Criteria:**

- [ ] Leaderboard refreshes every 30 seconds
- [ ] Manual refresh button is available
- [ ] Loading state shown during refresh

---

## Phase 5: Integration

### T13: Error Handling and Edge Cases

**Description:**

Implement comprehensive error handling for all API calls.

**Dependencies:**

- T3

**Acceptance Criteria:**

- [ ] Network errors display retry option
- [ ] 403 errors show "Event has concluded" message
- [ ] Session expiration redirects to login
- [ ] Offline mode detected and handled

**PRD Reference:** Section 9

---

### T14: Deployment Configuration

**Description:**

Configure the project for Netlify deployment.

**Dependencies:**

- T1

**Acceptance Criteria:**

- [ ] `netlify.toml` configured
- [ ] Build command: `npm run build`
- [ ] Publish directory: `dist`
- [ ] Environment variables configured in Netlify dashboard

**PRD Reference:** Section 8.2

**Environment Variables:**

| Variable | Source |
|----------|--------|
| VITE_API_BASE_URL | Backend Render URL |
| VITE_GOOGLE_CLIENT_ID | Google OAuth Client ID |

---

## Phase 6: Testing

### T15: Set Up Testing Infrastructure

**Description:**

Configure the testing framework and infrastructure for React component and integration tests.

**Dependencies:**

- T1

**Acceptance Criteria:**

- [ ] Vitest configured with jsdom environment
- [ ] `@testing-library/react` installed for component testing
- [ ] `@testing-library/user-event` installed for simulating user interactions
- [ ] Mock Service Worker (MSW) configured to mock API endpoints in tests
- [ ] Test render helper that wraps components with required providers (Router, AuthContext, GoogleOAuthProvider)
- [ ] `npm test` runs the full suite

**Required Dependencies:**

```json
{
  "devDependencies": {
    "vitest": "^1.x",
    "@testing-library/react": "^14.x",
    "@testing-library/jest-dom": "^6.x",
    "@testing-library/user-event": "^14.x",
    "jsdom": "^24.x",
    "msw": "^2.x"
  }
}
```

---

### T16: Component Unit Tests

**Description:**

Write unit tests for individual React components covering rendering, user interactions, and state.

**Dependencies:**

- T15, T8

**Acceptance Criteria:**

- [ ] **LoginPage (T4):** renders Google OAuth button, triggers login flow on click
- [ ] **OnboardingPage (T5):** validates empty employee_id input, submits valid form, shows error on API failure
- [ ] **QuizContainer (T6):** shows "Start Quiz" button when not started, redirects to current question when in progress, shows completion message when done
- [ ] **QuestionDisplay (T8):** renders question text and 4 options, shows progress indicator ("Question N of 10"), calls answer API on "Next"/"Submit" click
- [ ] **CompletionScreen (T10):** displays score from answer response or status endpoint, shows leaderboard link, no retake option visible
- [ ] **LeaderboardPage (T11):** renders ranked list, highlights current user's row, handles empty state

---

### T17: Integration Flow Tests

**Description:**

Write end-to-end integration tests covering complete user flows through the application using mocked API responses.

**Dependencies:**

- T15, T10

**Acceptance Criteria:**

- [ ] **Auth flow:** login (Google OAuth mock) → redirected to `/onboard` → submit employee_id → redirected to `/quiz`
- [ ] **Quiz flow:** click "Start Quiz" → answer Q1 through Q9 with "Next" → answer Q10 with "Submit" → completion screen shows score
- [ ] **Session resumption:** mid-quiz state (answered Q1–Q4) → simulate page reload → `GET /api/quiz/status` returns `current_sequence: 5` → user resumes at Q5
- [ ] **Error handling:** 401 response clears token and redirects to `/`, 403 deadline response shows "Event has concluded" message, network error shows retry option
- [ ] **Route protection:** unauthenticated access to `/quiz` redirects to `/`, authenticated user without `employee_id` accessing `/quiz` redirects to `/onboard`

---

## Dependencies Matrix

```
T1  ─────► T2 ─────► T3
        │            │
        │            ├────────► T4 ─────► T5
        │            │
        │            ├────────► T6 ─────► T7 ─────► T8 ─────► T9 ─────► T10
        │            │            │         │                   │
        │            │            │         └───────────────────┴────────► T11 ─────► T12
        │            │            │
        │            │            └─────────────────────────────────────────────► T13
        │            │
        │            └─────────────────────────────────────────────────────────────► T14
        │
        └──► T15 ──┬──► T16 (Component tests, depends on T8)
                   └──► T17 (Integration tests, depends on T10)
```

**Legend:**

- `A ─────► B` means A must complete before B can start
- Tasks T16–T17 also depend on completed component tasks (noted in parentheses) but those are not sequential blockers for test infrastructure setup

---

## Component Hierarchy

```
App
├── Router
│   ├── PublicRoutes
│   │   └── LoginPage (T4)
│   │
│   ├── ProtectedRoutes
│   │   ├── OnboardingPage (T5)
│   │   │
│   │   ├── QuizRoutes
│   │   │   ├── QuizContainer (T6)
│   │   │   │   ├── StartQuizButton (T7)
│   │   │   │   └── QuestionDisplay (T8, T9)
│   │   │   │
│   │   │   └── CompletionScreen (T10)
│   │   │
│   │   └── LeaderboardPage (T11, T12)
│   │
│   └── ErrorBoundary (T13)
```

---

## API Endpoints Summary

| Endpoint | Method | Frontend Task | Payload/Response |
|----------|--------|---------------|------------------|
| `/api/auth/google` | POST | T4 | `{ token }` → `{ token, user, onboarding_required }` |
| `/api/auth/onboard` | POST | T5 | `{ employee_id }` → `{ success }` |
| `/api/quiz/status` | GET | T6 | → `{ started, completed, current_sequence }` |
| `/api/quiz/start` | POST | T7 | → `{ started, completed, current_sequence, started_at }` |
| `/api/quiz/question/:sequence` | GET | T8 | → `{ sequence_order, question, options }` |
| `/api/quiz/answer` | POST | T9 | `{ sequence_order, answer }` → `{ success }` (Q1–Q9) / `{ success, completed, score }` (Q10) |
| `/api/leaderboard` | GET | T11 | → `[ { rank, name, employee_id, score, duration_seconds } ]` |

---

## Tailwind CSS Theme

Based on PRD requirements for a professional quiz platform:

| Element | Style |
|---------|-------|
| Primary color | Blue (#2563EB) |
| Background | Light gray (#F9FAFB) |
| Card background | White (#FFFFFF) |
| Success | Green (#10B981) |
| Error | Red (#EF4444) |
| Text primary | Gray (#1F2937) |
| Text secondary | Gray (#6B7280) |