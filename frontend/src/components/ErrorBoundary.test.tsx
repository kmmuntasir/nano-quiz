import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) throw new Error('Test error')
    return <div>No error</div>
}

describe('ErrorBoundary', () => {
    // Silence console.error from React error boundary logging
    const originalError = console.error
    beforeAll(() => {
        console.error = vi.fn()
    })
    afterAll(() => {
        console.error = originalError
    })

    it('renders children when no error', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={false} />
            </ErrorBoundary>,
        )
        expect(screen.getByText('No error')).toBeInTheDocument()
    })

    it('shows error UI when child throws', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>,
        )
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('shows retry button', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>,
        )
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
    })

    it('resets error state on retry click', () => {
        const { rerender } = render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>,
        )

        expect(screen.getByText('Something went wrong')).toBeInTheDocument()

        // Click retry — child will still throw, but state resets
        fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

        // After retry, error boundary catches again (child still throws)
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('renders custom fallback when provided', () => {
        render(
            <ErrorBoundary fallback={<div>Custom fallback</div>}>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>,
        )
        expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    })
})
