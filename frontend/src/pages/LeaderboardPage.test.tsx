import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import LeaderboardPage from './LeaderboardPage'
import { AuthContext } from '../contexts/AuthContext'

vi.mock('../api/client', () => ({
    default: {
        get: vi.fn(),
    },
}))

const mockApi = vi.mocked(await import('../api/client')).default

const mockEntries = [
    { rank: 1, name: 'Alice', employee_id: 'EMP1', score: 10, duration_seconds: 120 },
    { rank: 2, name: 'Bob', employee_id: 'EMP2', score: 8, duration_seconds: 245 },
    { rank: 3, name: 'Charlie', employee_id: 'EMP3', score: 7, duration_seconds: 300 },
]

function renderWithAuth(employeeId: string | null = null) {
    const authValue = {
        user: employeeId
            ? { id: '1', email: 'test@test.com', name: 'Test', employee_id: employeeId }
            : null,
        token: 'fake-token',
        isAuthenticated: true,
        hasOnboarded: !!employeeId,
        quizStatus: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        setOnboarded: vi.fn(),
        refreshQuizStatus: vi.fn(),
    }
    return render(
        <AuthContext.Provider value={authValue}>
            <LeaderboardPage />
        </AuthContext.Provider>,
    )
}

describe('LeaderboardPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders leaderboard heading', async () => {
        mockApi.get.mockResolvedValueOnce({ data: mockEntries })
        renderWithAuth()
        await waitFor(() => {
            expect(screen.getByText('Leaderboard')).toBeInTheDocument()
        })
    })

    it('renders ranked list from API', async () => {
        mockApi.get.mockResolvedValueOnce({ data: mockEntries })
        renderWithAuth()

        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeInTheDocument()
        })
        expect(screen.getByText('Bob')).toBeInTheDocument()
        expect(screen.getByText('Charlie')).toBeInTheDocument()
        expect(screen.getByText('10/10')).toBeInTheDocument()
        expect(screen.getByText('8/10')).toBeInTheDocument()
    })

    it('formats duration as mm:ss', async () => {
        mockApi.get.mockResolvedValueOnce({ data: mockEntries })
        renderWithAuth()

        await waitFor(() => {
            expect(screen.getByText('2:00')).toBeInTheDocument()
        })
        expect(screen.getByText('4:05')).toBeInTheDocument()
        expect(screen.getByText('5:00')).toBeInTheDocument()
    })

    it('highlights current user row', async () => {
        mockApi.get.mockResolvedValueOnce({ data: mockEntries })
        renderWithAuth('EMP2')

        await waitFor(() => {
            expect(screen.getByText('Bob')).toBeInTheDocument()
        })

        const bobRow = screen.getByText('Bob').closest('tr')
        expect(bobRow?.className).toContain('font-semibold')
    })

    it('handles empty state when no entries', async () => {
        mockApi.get.mockResolvedValueOnce({ data: [] })
        renderWithAuth()

        await waitFor(() => {
            expect(
                screen.getByText('No scores yet. Be the first to complete the quiz!'),
            ).toBeInTheDocument()
        })
    })

    it('shows error on API failure', async () => {
        mockApi.get.mockRejectedValueOnce(new Error('Network error'))
        renderWithAuth()

        await waitFor(() => {
            expect(screen.getByText('Failed to load leaderboard.')).toBeInTheDocument()
        })
    })
})
