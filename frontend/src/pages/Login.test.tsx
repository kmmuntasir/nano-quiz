import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import Login from './Login'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@react-oauth/google', () => ({
    GoogleLogin: ({ onSuccess, disabled }: any) => (
        <button
            data-testid="google-login"
            onClick={() => onSuccess?.({ credential: 'test-google-credential' })}
            disabled={disabled}
        >
            Sign in with Google
        </button>
    ),
}))

function renderLogin(authOverrides: Record<string, any> = {}) {
    const login = vi.fn()
    const authValue = {
        user: null,
        token: null,
        isAuthenticated: false,
        hasOnboarded: false,
        quizStatus: null,
        loading: false,
        login,
        logout: vi.fn(),
        setOnboarded: vi.fn(),
        refreshQuizStatus: vi.fn(async () => null),
        ...authOverrides,
    }

    const result = render(
        <AuthContext.Provider value={authValue}>
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        </AuthContext.Provider>,
    )

    return { ...result, login }
}

describe('Login', () => {
    beforeEach(() => {
        mockNavigate.mockClear()
    })

    it('renders Google OAuth button', () => {
        renderLogin()
        expect(screen.getByTestId('google-login')).toBeInTheDocument()
        expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
    })

    it('renders NanoQuiz heading and subtitle', () => {
        renderLogin()
        expect(screen.getByText('NanoQuiz')).toBeInTheDocument()
        expect(screen.getByText('Sign in to start the quiz')).toBeInTheDocument()
    })

    it('calls login on successful Google OAuth', async () => {
        const { login } = renderLogin()
        login.mockResolvedValue(false)

        fireEvent.click(screen.getByTestId('google-login'))

        await waitFor(() => {
            expect(login).toHaveBeenCalledWith('test-google-credential')
        })
    })

    it('navigates to /onboard when login returns true', async () => {
        const { login } = renderLogin()
        login.mockResolvedValue(true)

        fireEvent.click(screen.getByTestId('google-login'))

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/onboard', { replace: true })
        })
    })

    it('navigates to /quiz when login returns false', async () => {
        const { login } = renderLogin()
        login.mockResolvedValue(false)

        fireEvent.click(screen.getByTestId('google-login'))

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/quiz', { replace: true })
        })
    })

    it('shows error on login failure', async () => {
        const { login } = renderLogin()
        login.mockRejectedValue(new Error('Invalid token'))

        fireEvent.click(screen.getByTestId('google-login'))

        await waitFor(() => {
            expect(screen.getByText('Invalid token')).toBeInTheDocument()
        })
    })

    it('disables button during login', async () => {
        const { login } = renderLogin()
        login.mockImplementation(() => new Promise(() => {}))

        fireEvent.click(screen.getByTestId('google-login'))

        await waitFor(() => {
            expect(screen.getByTestId('google-login')).toBeDisabled()
        })
    })

    it('redirects to /quiz when already authenticated and onboarded', () => {
        renderLogin({
            isAuthenticated: true,
            hasOnboarded: true,
            user: { id: '1', email: 'test@test.com', name: 'Test', employee_id: 'E1' },
            token: 'jwt',
        })
        expect(mockNavigate).toHaveBeenCalledWith('/quiz', { replace: true })
    })

    it('redirects to /onboard when authenticated but not onboarded', () => {
        renderLogin({
            isAuthenticated: true,
            hasOnboarded: false,
            user: { id: '1', email: 'test@test.com', name: 'Test', employee_id: null },
            token: 'jwt',
        })
        expect(mockNavigate).toHaveBeenCalledWith('/onboard', { replace: true })
    })
})
