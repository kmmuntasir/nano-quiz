# Frontend Development Rules

## General

React 19.2.x + TypeScript + Vite + Tailwind CSS. Routing via React Router v6. HTTP via Axios (shared client with JWT interceptor). Global state via React Context (`AuthContext`). Tests via Vitest + Testing Library; API mocks via MSW.

## Project Structure

```
frontend/
    src/
        main.tsx           # Entry, GoogleOAuthProvider wrapper
        App.tsx            # Lazy-loaded routes with Suspense + ErrorBoundary
        contexts/          # AuthContext.tsx — auth state, token, quizStatus, localStorage
        api/               # client.ts — Axios with JWT interceptor, custom errors
        pages/             # Login, Onboarding, QuizContainer, Question, CompletionScreen, LeaderboardPage
        components/        # QuestionDisplay, StartQuizButton, ProtectedRoute, ErrorBoundary, ErrorMessage, EventConcluded, OfflineBanner
        hooks/             # useAuth, useOfflineStatus
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
- Extract reusable logic into custom hooks (`useAuth`, `useOfflineStatus`).

## State Management

- **Global/domain state** — React Context. This project uses `AuthContext` (user, token, quizStatus, onboarding) with localStorage persistence and an auto-fetch of `/quiz/status` on mount. Do NOT introduce Redux/Zustand/etc.
- **Local state** — `useState`. Don't reach for global state when local suffices.
- **URL state** — React Router v6 params and search params for shareable state.
- **Form state** — controlled components + local state with simple validation. Do NOT introduce a form library unless the project uses one.

## Styling — Tailwind CSS

- Use Tailwind utility classes directly in JSX (`className="..."`). Avoid inline `style={{}}`.
- Theme values (colors, fonts, spacing) live in `tailwind.config.js`. Reference tokens/utilities; avoid stray arbitrary magic values when a theme token exists.
- Do NOT introduce Chakra, Material UI, styled-components, CSS Modules, or a different styling mechanism.

## Routing — React Router v6

- Lazy-loaded routes with `React.lazy` + Suspense + ErrorBoundary (as in `App.tsx`).
- **Route order matters:** define `/quiz/complete` **before** `/quiz/:sequence`. React Router matches top-to-bottom — `:sequence` would capture `complete` as a param value.
- Gate routes with `ProtectedRoute` (`requireEmployeeId` / `requireQuizStarted` / `requireQuizCompleted`).

## API Client

- Use the shared client (`api/client.ts`) — Axios with JWT interceptor, 401 auto-logout, custom errors (`ApiError`, `EventConcludedError`).
- Service functions return typed data: `async function fetchQuizStatus(): Promise<QuizStatus>`.
- Match the backend contract exactly (`docs/api-docs/API.md`) — never invent shapes.
- Bearer token from `AuthContext`; injected via interceptor.

```typescript
async function fetchQuizStatus(): Promise<QuizStatus> {
  const { data } = await apiClient.get<QuizStatus>('/quiz/status')
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