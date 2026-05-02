import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CompletionScreen from './CompletionScreen'

const mockRefreshQuizStatus = vi.fn()

vi.mock('../hooks/useAuth', () => ({
    useAuth: () => ({
        quizStatus: null,
        refreshQuizStatus: mockRefreshQuizStatus,
    }),
}))

function renderCompletion() {
    return render(
        <MemoryRouter initialEntries={['/quiz/complete']}>
            <CompletionScreen />
        </MemoryRouter>,
    )
}

describe('CompletionScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders completion heading', async () => {
        mockRefreshQuizStatus.mockResolvedValue({ score: 8, completed: true })
        renderCompletion()

        await waitFor(() => {
            expect(screen.getByText('Quiz Complete!')).toBeInTheDocument()
        })
    })

    it('displays score from API fallback', async () => {
        mockRefreshQuizStatus.mockResolvedValue({ score: 8, completed: true })
        renderCompletion()

        await waitFor(() => {
            expect(screen.getByText('You scored 8 out of 10!')).toBeInTheDocument()
        })
    })

    it('displays fallback message when score is unavailable', async () => {
        mockRefreshQuizStatus.mockResolvedValue({ completed: true })
        renderCompletion()

        await waitFor(() => {
            expect(screen.getByText('Your responses have been recorded.')).toBeInTheDocument()
        })
    })

    it('shows leaderboard link', async () => {
        mockRefreshQuizStatus.mockResolvedValue({ score: 5, completed: true })
        renderCompletion()

        await waitFor(() => {
            const link = screen.getByText('View Leaderboard')
            expect(link).toBeInTheDocument()
            expect(link.closest('a')).toHaveAttribute('href', '/leaderboard')
        })
    })

    it('has no retake option visible', async () => {
        mockRefreshQuizStatus.mockResolvedValue({ score: 5, completed: true })
        renderCompletion()

        await waitFor(() => {
            expect(screen.getByText('Quiz Complete!')).toBeInTheDocument()
        })

        expect(screen.queryByText(/retake/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/try again/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument()
    })

    it('shows checkmark icon', async () => {
        mockRefreshQuizStatus.mockResolvedValue({ score: 5, completed: true })
        renderCompletion()

        await waitFor(() => {
            const svg = document.querySelector('svg')
            expect(svg).toBeInTheDocument()
        })
    })

    it('shows perfect score message for 10/10', async () => {
        mockRefreshQuizStatus.mockResolvedValue({ score: 10, completed: true })
        renderCompletion()

        await waitFor(() => {
            expect(screen.getByText(/Perfect score/)).toBeInTheDocument()
        })
    })

    it('shows excellent message for score >= 8', async () => {
        mockRefreshQuizStatus.mockResolvedValue({ score: 8, completed: true })
        renderCompletion()

        await waitFor(() => {
            expect(screen.getByText(/Excellent work/)).toBeInTheDocument()
        })
    })

    it('shows good job message for score >= 6', async () => {
        mockRefreshQuizStatus.mockResolvedValue({ score: 6, completed: true })
        renderCompletion()

        await waitFor(() => {
            expect(screen.getByText(/Good job/)).toBeInTheDocument()
        })
    })

    it('shows participation message for low scores', async () => {
        mockRefreshQuizStatus.mockResolvedValue({ score: 3, completed: true })
        renderCompletion()

        await waitFor(() => {
            expect(screen.getByText(/Thanks for participating/)).toBeInTheDocument()
        })
    })
})
