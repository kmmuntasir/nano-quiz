# JavaScript Style Guide

## Formatting

- Use Prettier for formatting (integrated with VS Code and ESLint).
- Line length: 100 characters max.
- Use 4 spaces for indentation in JSX, 2 spaces in JavaScript.
- Trailing commas in arrays and objects.

## Naming Conventions

### Files
- Components: PascalCase (e.g., `QuizButton.tsx`, `UserCard.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useQuiz.ts`, `useAuth.ts`)
- Utils: camelCase (e.g., `quizUtils.ts`, `validation.ts`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `API_ENDPOINTS.ts`)

### Variables and Functions
- camelCase for variables and functions
- PascalCase for React components and TypeScript types/interfaces
- SCREAMING_SNAKE_CASE for constants

```typescript
// Components
function QuizButton() { }
interface QuizQuestion { }

// Types
type QuizStatus = 'pending' | 'in_progress' | 'completed'

// Constants
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// Variables
const currentQuestion = 1
```

### Acronyms
- Keep acronyms consistent case: `URL`, `ID`, `HTTP`, `API` (all caps)

## Code Structure

### Functions

- Keep functions short and focused (<50 lines).
- Use early returns to reduce nesting.
- Use async/await over raw promises.

```typescript
async function startQuiz(userId: string): Promise<QuizSession> {
    if (!userId) {
        throw new Error('User ID is required')
    }

    const session = await createSession(userId)
    return session
}
```

### Error Handling

```typescript
try {
    const response = await fetchQuizQuestions()
    return response.json()
} catch (error) {
    console.error('Failed to fetch questions:', error)
    throw new ApiError('Failed to fetch quiz questions')
}
```

### React Components

- Use functional components with hooks.
- Extract reusable logic into custom hooks.
- Keep components focused (single responsibility).

```typescript
export function QuizCard({ question, onAnswer }: QuizCardProps) {
    const [selected, setSelected] = useState<string | null>(null)

    const handleSelect = (option: string) => {
        setSelected(option)
        onAnswer(option)
    }

    return (
        <div className="quiz-card">
            <h2>{question.text}</h2>
            {question.options.map(opt => (
                <button key={opt.id} onClick={() => handleSelect(opt.id)}>
                    {opt.text}
                </button>
            ))}
        </div>
    )
}
```

### Props Interface

Define explicit prop types:

```typescript
interface QuizCardProps {
    question: QuizQuestion
    onAnswer: (answer: string) => void
    disabled?: boolean
}
```

## Import Organization

Organize imports in this order:

1. External libraries (React, React Query, etc.)
2. Internal imports (components, hooks, utils)
3. Type imports
4. Relative imports

```typescript
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QuizCard } from '@/components/QuizCard'
import { useQuiz } from '@/hooks/useQuiz'
import type { QuizQuestion } from '@/types'
import { API_ENDPOINTS } from '@/constants'
```

## Things to Avoid

- `any` type — use explicit types or `unknown`
- `console.log` in production — use a proper logger
- Inline styles — use Tailwind CSS classes
- Unnecessary `useMemo`/`useCallback` — only optimize when needed
- Magic numbers — define constants
- Prop drilling — use React Context