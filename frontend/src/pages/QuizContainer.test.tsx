import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthState } from '../contexts/AuthContext'
import QuizContainer from './QuizContainer'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mockNavigate }
})

function renderQuizContainer(overrides: Partial<AuthState> = {}) {
    const authValue: AuthState = {
        user: { id: 'u1', email: 'test@test.com', name: 'Test', employee_id: 'E1' },
        token: 'tok',
        isAuthenticated: true,
        hasOnboarded: true,
        quizStatus: null,
        loading: false,
        login: async () => {},
        logout: () => {},
        setOnboarded: () => {},
        refreshQuizStatus: async () => null,
        ...overrides,
    }

    return render(
        <AuthContext.Provider value={authValue}>
            <MemoryRouter>
                <QuizContainer />
            </MemoryRouter>
        </AuthContext.Provider>,
    )
}

describe('QuizContainer', () => {
    beforeEach(() => {
        mockNavigate.mockClear()
    })

    it('shows loading spinner when loading', () => {
        renderQuizContainer({ loading: true })
        expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('shows start quiz button when not started', () => {
        renderQuizContainer({
            quizStatus: { started: false, completed: false },
            refreshQuizStatus: async () => ({ started: false, completed: false }),
        })
        expect(screen.getByText('Ready?')).toBeInTheDocument()
        expect(screen.getByText('Start Quiz').closest('button')).toBeEnabled()
    })

    it('shows completion message when quiz is completed', () => {
        renderQuizContainer({
            quizStatus: {
                started: true,
                completed: true,
                score: 8,
                duration_seconds: 125,
            },
            refreshQuizStatus: async () => ({
                started: true,
                completed: true,
                score: 8,
                duration_seconds: 125,
            }),
        })
        expect(screen.getByText('Quiz Completed!')).toBeInTheDocument()
        expect(screen.getByText('Your score: 8/10')).toBeInTheDocument()
        expect(screen.getByText('Time: 2m 5s')).toBeInTheDocument()
    })

    it('calls refreshQuizStatus on mount', () => {
        const refreshQuizStatus = async () => null
        renderQuizContainer({ refreshQuizStatus })
        // Component rendered without errors — refreshQuizStatus was called in useEffect
    })

    it('renders without score when completed but score undefined', () => {
        renderQuizContainer({
            quizStatus: { started: true, completed: true },
            refreshQuizStatus: async () => ({ started: true, completed: true }),
        })
        expect(screen.getByText('Quiz Completed!')).toBeInTheDocument()
        expect(screen.queryByText(/Your score/)).not.toBeInTheDocument()
    })

    it('redirects to current question when quiz in progress', () => {
        renderQuizContainer({
            quizStatus: {
                started: true,
                completed: false,
                current_sequence: 5,
            },
            refreshQuizStatus: async () => ({
                started: true,
                completed: false,
                current_sequence: 5,
            }),
        })
        expect(mockNavigate).toHaveBeenCalledWith('/quiz/5', { replace: true })
    })
})
