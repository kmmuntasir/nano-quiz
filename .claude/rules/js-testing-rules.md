# JavaScript Testing Rules

## Overview

This project uses Vitest for testing (Vite-native test runner). Use Vitest for both unit and integration tests.

## Test Organization

```
frontend/src/
    components/
        Button.tsx
        Button.test.tsx    # Co-located with source
    hooks/
        useQuiz.ts
        useQuiz.test.ts
backend/
    routes/
        quiz.js
        quiz.test.js
```

Tests live alongside the code they test, in `*.test.ts` or `*.test.js` files.

## Unit Tests

### Table-Driven Tests

The preferred pattern for most test scenarios:

```typescript
import { describe, it, expect } from 'vitest'
import { validateAnswer } from './quizUtils'

describe('validateAnswer', () => {
    const tests = [
        { name: 'valid answer', input: { questionId: 1, answer: 'A' }, expected: true },
        { name: 'invalid option', input: { questionId: 1, answer: 'X' }, expected: false },
        { name: 'empty answer', input: { questionId: 1, answer: '' }, expected: false },
    ]

    tests.forEach(({ name, input, expected }) => {
        it(name, () => {
            expect(validateAnswer(input)).toBe(expected)
        })
    })
})
```

### Mocking

Use Vitest's built-in `vi.fn()` for mocks:

```typescript
const mockFetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ score: 10 })))
global.fetch = mockFetch
```

For React components, use `@testing-library/react`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { QuizButton } from './QuizButton'

it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<QuizButton onClick={onClick}>Submit</QuizButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
})
```

## Integration Tests

Tests that require a running backend should use build tags or environment checks:

```typescript
import { describe, it } from 'vitest'

describe('API integration', () => {
    it('fetches quiz questions', async () => {
        const response = await fetch('/api/quiz/status')
        expect(response.ok).toBe(true)
    })
})
```

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# Specific file
npm test -- src/components/Button.test.ts

# Run backend tests
npm test -- --root backend
```

## Best Practices

### Test Naming

- Test functions: `it('description')` or `test('description')`
- Describe groups: `describe('ComponentName')`

### Testing Library Priority

Use this priority order:
1. `getByRole` (most accessible)
2. `getByLabelText`
3. `getByText`
4. `getByTestId` (last resort)

### Assertions

Use Vitest's expect API:
- `expect(value).toBe(expected)`
- `expect(value).toEqual(expected)`
- `expect(value).toBeTruthy()`
- `expect(fn).toThrow()`

## Coverage Targets

- Business logic: >80%
- Components: >70%
- Integration: critical flows only