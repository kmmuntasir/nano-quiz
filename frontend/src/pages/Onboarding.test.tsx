import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import Onboarding from './Onboarding'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../api/client', () => ({
    default: { post: vi.fn() },
}))

import api from '../api/client'

function renderOnboarding(authOverrides: Record<string, any> = {}) {
    const setOnboarded = vi.fn()
    const authValue = {
        user: { id: 'u1', email: 'test@test.com', name: 'Test User', employee_id: null },
        token: 'jwt',
        isAuthenticated: true,
        hasOnboarded: false,
        quizStatus: null,
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        setOnboarded,
        refreshQuizStatus: vi.fn(async () => null),
        ...authOverrides,
    }

    const result = render(
        <AuthContext.Provider value={authValue}>
            <MemoryRouter>
                <Onboarding />
            </MemoryRouter>
        </AuthContext.Provider>,
    )

    return { ...result, setOnboarded }
}

describe('Onboarding', () => {
    beforeEach(() => {
        mockNavigate.mockClear()
        vi.mocked(api.post).mockResolvedValue({
            data: { user: { id: 'u1', employee_id: 'EMP001' } },
        })
    })

    it('validates empty employee_id input', async () => {
        renderOnboarding()

        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

        await waitFor(() => {
            expect(screen.getByText('Employee ID is required.')).toBeInTheDocument()
        })
    })

    it('submits valid form with employee_id', async () => {
        renderOnboarding()

        fireEvent.change(screen.getByPlaceholderText('Employee ID'), {
            target: { value: 'EMP123' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/auth/onboard', {
                employee_id: 'EMP123',
            })
        })
    })

    it('trims whitespace from employee_id', async () => {
        renderOnboarding()

        fireEvent.change(screen.getByPlaceholderText('Employee ID'), {
            target: { value: '  EMP123  ' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/auth/onboard', {
                employee_id: 'EMP123',
            })
        })
    })

    it('calls setOnboarded on success', async () => {
        const { setOnboarded } = renderOnboarding()

        fireEvent.change(screen.getByPlaceholderText('Employee ID'), {
            target: { value: 'EMP123' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

        await waitFor(() => {
            expect(setOnboarded).toHaveBeenCalledWith('EMP123')
        })
    })

    it('navigates to /quiz on success', async () => {
        renderOnboarding()

        fireEvent.change(screen.getByPlaceholderText('Employee ID'), {
            target: { value: 'EMP123' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/quiz', { replace: true })
        })
    })

    it('shows error on API failure', async () => {
        vi.mocked(api.post).mockRejectedValue(new Error('Server error'))
        renderOnboarding()

        fireEvent.change(screen.getByPlaceholderText('Employee ID'), {
            target: { value: 'EMP123' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

        await waitFor(() => {
            expect(screen.getByText('Server error')).toBeInTheDocument()
        })
    })

    it('shows loading state during submission', async () => {
        vi.mocked(api.post).mockImplementation(() => new Promise(() => {}))
        renderOnboarding()

        fireEvent.change(screen.getByPlaceholderText('Employee ID'), {
            target: { value: 'EMP123' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

        await waitFor(() => {
            expect(screen.getByText('Saving...')).toBeInTheDocument()
        })
    })

    it('renders welcome message with user name', () => {
        renderOnboarding()
        expect(screen.getByText('Welcome, Test User!')).toBeInTheDocument()
    })
})
