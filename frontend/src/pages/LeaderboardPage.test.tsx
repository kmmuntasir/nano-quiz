import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LeaderboardPage from './LeaderboardPage'

describe('LeaderboardPage', () => {
    it('renders leaderboard heading', () => {
        render(<LeaderboardPage />)
        expect(screen.getByText('Leaderboard')).toBeInTheDocument()
    })

    it('renders placeholder text', () => {
        render(<LeaderboardPage />)
        expect(screen.getByText('Rankings will appear here')).toBeInTheDocument()
    })

    it.skip('renders ranked list from API', () => {
        // TODO: Enable when LeaderboardPage fetches and renders leaderboard data
    })

    it.skip('highlights current user row', () => {
        // TODO: Enable when current user highlighting is implemented
    })

    it.skip('handles empty state when no entries', () => {
        // TODO: Enable when empty state handling is implemented
    })
})
