import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorMessage from './ErrorMessage'

describe('ErrorMessage', () => {
    it('renders default message', () => {
        render(<ErrorMessage />)
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    })

    it('renders custom message', () => {
        render(<ErrorMessage message="Network error" />)
        expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    it('renders retry button when onRetry provided', () => {
        const onRetry = vi.fn()
        render(<ErrorMessage onRetry={onRetry} />)
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })

    it('hides retry button when onRetry omitted', () => {
        render(<ErrorMessage />)
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('calls onRetry when button clicked', () => {
        const onRetry = vi.fn()
        render(<ErrorMessage onRetry={onRetry} />)
        fireEvent.click(screen.getByRole('button'))
        expect(onRetry).toHaveBeenCalledOnce()
    })

    it('uses custom retry label', () => {
        render(<ErrorMessage onRetry={() => {}} retryLabel="Try again" />)
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('has alert role', () => {
        render(<ErrorMessage />)
        expect(screen.getByRole('alert')).toBeInTheDocument()
    })
})
