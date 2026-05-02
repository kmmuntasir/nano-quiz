import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import StartQuizButton from './StartQuizButton'
import type { QuizStatus } from '../contexts/AuthContext'

vi.mock('../api/client', () => ({
    default: { post: vi.fn() },
}))

import api from '../api/client'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mockNavigate }
})

function renderWithAuth(overrides: Partial<{ refreshQuizStatusReturn: QuizStatus | null }> = {}) {
    const refreshQuizStatus = vi.fn(async (): Promise<QuizStatus | null> => {
        return overrides.refreshQuizStatusReturn ?? { started: true, completed: false, current_sequence: 1 }
    })

    const value = {
        user: { id: 'u1', email: 'test@test.com', name: 'Test', employee_id: 'E1' },
        token: 'jwt',
        isAuthenticated: true,
        hasOnboarded: true,
        quizStatus: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        setOnboarded: vi.fn(),
        refreshQuizStatus,
    }

    const result = render(
        <AuthContext.Provider value={value}>
            <BrowserRouter>
                <StartQuizButton />
            </BrowserRouter>
        </AuthContext.Provider>,
    )

    return { ...result, refreshQuizStatus }
}

describe('StartQuizButton', () => {
    beforeEach(() => {
        vi.mocked(api.post).mockResolvedValue({ data: { message: 'Quiz started' } })
        mockNavigate.mockClear()
    })

    it('renders enabled Start Quiz button', () => {
        renderWithAuth()
        expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeEnabled()
    })

    it('shows loading state on click', async () => {
        vi.mocked(api.post).mockImplementation(() => new Promise(() => {}))
        renderWithAuth()
        fireEvent.click(screen.getByRole('button'))
        expect(screen.getByText('Starting...')).toBeInTheDocument()
        expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('navigates to first question on success', async () => {
        renderWithAuth()
        fireEvent.click(screen.getByRole('button'))
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/quiz/1', { replace: true })
        })
    })

    it('navigates using current_sequence from status', async () => {
        renderWithAuth({
            refreshQuizStatusReturn: { started: true, completed: false, current_sequence: 3 },
        })
        fireEvent.click(screen.getByRole('button'))
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/quiz/3', { replace: true })
        })
    })

    it('falls back to /quiz/1 when current_sequence missing', async () => {
        renderWithAuth({
            refreshQuizStatusReturn: { started: true, completed: false },
        })
        fireEvent.click(screen.getByRole('button'))
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/quiz/1', { replace: true })
        })
    })

    it('shows error when API fails', async () => {
        vi.mocked(api.post).mockRejectedValue(new Error('Server error'))
        renderWithAuth()
        fireEvent.click(screen.getByRole('button'))
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument()
            expect(screen.getByText('Server error')).toBeInTheDocument()
        })
    })

    it('shows Try Again button on error', async () => {
        vi.mocked(api.post).mockRejectedValue(new Error('Server error'))
        renderWithAuth()
        fireEvent.click(screen.getByRole('button'))
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
        })
    })
})
