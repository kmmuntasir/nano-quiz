import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CompletionScreen from './CompletionScreen'

describe('CompletionScreen', () => {
    it('renders completion heading', () => {
        render(<CompletionScreen />)
        expect(screen.getByText('Quiz Complete!')).toBeInTheDocument()
    })

    it('displays score placeholder', () => {
        render(<CompletionScreen />)
        expect(screen.getByText(/Your score/)).toBeInTheDocument()
    })

    it('shows leaderboard link', () => {
        render(<CompletionScreen />)
        const link = screen.getByText('View Leaderboard')
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', '/leaderboard')
    })

    it('has no retake option visible', () => {
        render(<CompletionScreen />)
        expect(screen.queryByText(/retake/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/try again/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument()
    })
})
