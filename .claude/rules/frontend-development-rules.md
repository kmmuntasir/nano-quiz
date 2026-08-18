# Frontend Development Rules

## General

React 19.2.x + TypeScript + Vite + Tailwind CSS. Routing via React Router v6. HTTP via Axios (shared client with JWT interceptor). Global state via React Context (`AuthContext`). Tests via Vitest + Testing Library; API mocks via MSW.

## Project Structure

```
frontend/
    src/
        main.tsx           # Entry, GoogleOAuthProvider wrapper
        App.tsx            # Lazy-loaded routes with Suspense + ErrorBoundary
        contexts/          # AuthContext.tsx — auth state, token, isAdmin, localStorage
        api/               # client.ts — Axios with JWT interceptor, custom errors
        pages/             # Login, QuizList, QuizPlay (one question at a time), Completion, Leaderboard, Admin
        components/        # QuizCard, StartQuizButton, QuestionDisplay, TimerCountdown, SubmitRetry, ProtectedRoute, ErrorBoundary, ErrorMessage
        hooks/             # useAuth, useQuizTimer
    public/
    index.html
    vite.config.ts
    tailwind.config.js
    tsconfig.json
```

## Component Conventions

- One component per file. PascalCase filenames: `QuestionDisplay.tsx`.
- Functional components + hooks only. No class components.
- Explicit prop interfaces (`QuestionDisplayProps`), no `any`.
- Co-locate `*.test.tsx` next to component.
- Reusability: any element duplicated at ≥90% similarity in two places becomes a component.
- Extract reusable logic into custom hooks (`useAuth`, `useQuizTimer`).

## State Management

- **Global/domain state** — React Context. This project uses `AuthContext` (user, token, isAdmin) with localStorage persistence. Do NOT introduce Redux/Zustand/etc.
- **Local state** — `useState`. Don't reach for global state when local suffices.
- **URL state** — React Router v6 params and search params for shareable state.
- **Form state** — controlled components + local state with simple validation (admin quiz/question forms). Do NOT introduce a form library unless the project uses one.

## Styling — Tailwind CSS

- Use Tailwind utility classes directly in JSX (`className="..."`). Avoid inline `style={{}}`.
- Theme values (colors, fonts, spacing) live in `tailwind.config.js`. Reference tokens/utilities; avoid stray arbitrary magic values when a theme token exists.
- Do NOT introduce Chakra, Material UI, styled-components, CSS Modules, or a different styling mechanism.

## Routing — React Router v6

- Lazy-loaded routes with `React.lazy` + Suspense + ErrorBoundary (as in `App.tsx`).
- **Admin routes are gated by `isAdmin`** (from JWT via `AuthContext`); the admin UI is hidden entirely from non-admins (route guard + no admin links rendered).
- Gate routes with `ProtectedRoute` (`requireAuth` / `requireAdmin`).

## Quiz Play flow

- **Start** → `POST /api/quizzes/:id/start` returns `{ seed, quizId, questionCount, timeLimitSeconds }`. Store in local state.
- **Per question** → `GET /api/quizzes/:id/question/:seq?seed=...` (send the seed from start). Render one question at a time; submit the answer to advance.
- **Timer** → per-quiz `timeLimitSeconds` countdown via `useQuizTimer`. On timeout, auto-advance — including the last question, which ends the quiz and triggers submit.
- **Submit** → `POST /api/quizzes/:id/submit` with `{ seed, answers, elapsedMs }`. The submit must have a **retry mechanism** (auto-retry on network failure + a manual retry button) because nothing is stored server-side until it lands.
- **No mid-way storage** — if the user abandons (closes the tab), there is no record; restart from the beginning.

## API Client

- Use the shared client (`api/client.ts`) — Axios with JWT interceptor, 401 auto-logout, custom errors (`ApiError`).
- Service functions return typed data: `async function fetchQuizzes(): Promise<Quiz[]>`, `async function startQuiz(id: string): Promise<QuizSession>`, etc.
- Match the backend contract exactly (`docs/api-docs/API.md`) — never invent shapes.
- Bearer token from `AuthContext`; injected via interceptor.

```typescript
async function fetchQuizzes(): Promise<Quiz[]> {
  const { data } = await apiClient.get<Quiz[]>('/quizzes')
  return data
}
```

## Environment Variables

Prefix with `VITE_`:

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

Validate at boot / on first use. Fail fast on missing required vars.

## Testing

- Unit/component: Vitest + Testing Library (jsdom).
- Mock API calls via MSW (`msw`) in component tests.
- Timer logic tested with Vitest fake timers.
- Co-locate `*.test.tsx` next to source.

## Build and Run

```bash
cd frontend
npm run dev          # Vite dev server (port 5173)
npm run build        # tsc -b && vite build
npm run preview      # Preview production build
npm run lint         # ESLint
npm run typecheck    # tsc -b
npm test             # vitest run
```

## Avoid

- `any` (use `unknown` when truly unknown).
- Inline `style={{}}` (use Tailwind utilities / theme tokens).
- Prop drilling past 2 levels (use Context).
- Premature `useMemo`/`useCallback` (optimize when measurable).
- Magic numbers (extract to constants).
- `console.log` in production paths (use error-boundary reporting / toasts).
- Introducing new state libraries or styling systems.