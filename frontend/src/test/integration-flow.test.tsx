import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import App from '../App'
import { renderWithProviders } from './render'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    }
})

vi.mock('@react-oauth/google', () => ({
    GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children,
    GoogleLogin: ({ onSuccess, disabled }: { onSuccess?: (result: any) => void; disabled?: boolean }) => (
        <button
            data-testid="google-login"
            onClick={() => onSuccess?.({ credential: 'test-google-credential' })}
            disabled={disabled}
        >
            Sign in with Google
        </button>
    ),
}))

vi.mock('../api/client', async () => {
    return {
        default: {
            post: vi.fn((url: string, body?: any) => {
                if (url === '/auth/google') {
                    return Promise.resolve({
                        data: {
                            token: 'test-jwt-token',
                            user: { id: 'test-user-id', email: 'test@example.com', name: 'Test User' },
                            onboarding_required: body?.employee_id === undefined,
                        },
                    })
                }
                if (url === '/auth/onboard') {
                    return Promise.resolve({
                        data: {
                            user: { id: 'test-user-id', email: 'test@example.com', name: 'Test User', employee_id: body.employee_id },
                        },
                    })
                }
                if (url === '/quiz/start') {
                    return Promise.resolve({ data: { message: 'Quiz started', total_questions: 10 } })
                }
                if (url === '/quiz/answer') {
                    if (body.sequence_order === 10) {
                        return Promise.resolve({ data: { message: 'Answer recorded', score: 8, completed_at: new Date().toISOString(), duration_seconds: 300 } })
                    }
                    return Promise.resolve({ data: { message: 'Answer recorded' } })
                }
                return Promise.reject(new Error('Unknown endpoint'))
            }),
            get: vi.fn((url: string) => {
                if (url.startsWith('/quiz/question/')) {
                    const seq = parseInt(url.split('/').pop() || '1')
                    return Promise.resolve({
                        data: {
                            sequence_order: seq,
                            question: `Sample question ${seq}?`,
                            options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
                        },
                    })
                }
                if (url === '/quiz/status') {
                    return Promise.resolve({ data: { status: 'not_started', started: false, completed: false } })
                }
                return Promise.reject(new Error('Unknown endpoint'))
            }),
        },
    }
})

describe('Integration Flow Tests', () => {
    beforeEach(() => {
        localStorage.clear()
        mockNavigate.mockClear()
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('Auth Flow', () => {
        it('login → redirect to /onboard → submit employee_id → redirect to /quiz', async () => {
            renderWithProviders(<App />, { route: '/', includeRouter: false })

            await waitFor(() => {
                expect(screen.getByText('NanoQuiz')).toBeInTheDocument()
            })

            const loginButton = screen.getByTestId('google-login')
            fireEvent.click(loginButton)

            await waitFor(() => {
                expect(screen.getByText('Welcome, Test User!')).toBeInTheDocument()
            }, { timeout: 3000 })

            const input = screen.getByPlaceholderText('Employee ID')
            fireEvent.change(input, { target: { value: 'EMP001' } })

            const continueButton = screen.getByRole('button', { name: /continue/i })
            fireEvent.click(continueButton)

            await waitFor(() => {
                expect(screen.getByText('Ready?')).toBeInTheDocument()
            }, { timeout: 3000 })
        })

        it('login with existing employee_id skips onboard', async () => {
            const api = await import('../api/client')
            vi.mocked(api.default.post).mockResolvedValueOnce({
                data: {
                    token: 'test-jwt-token',
                    user: { id: 'test-user-id', email: 'test@example.com', name: 'Test User', employee_id: 'EMP001' },
                    onboarding_required: false,
                },
            })

            renderWithProviders(<App />, { route: '/', includeRouter: false })

            const loginButton = screen.getByTestId('google-login')
            fireEvent.click(loginButton)

            await waitFor(() => {
                expect(screen.getByText('Ready?')).toBeInTheDocument()
            }, { timeout: 3000 })
        })
    })

    describe('Quiz Flow', () => {
        it('start quiz → answer Q1-Q9 with Next → answer Q10 with Submit → completion shows score', async () => {
            const api = await import('../api/client')

            vi.mocked(api.default.get).mockImplementation((url: string) => {
                if (url.startsWith('/quiz/question/')) {
                    const seq = parseInt(url.split('/').pop() || '1')
                    return Promise.resolve({
                        data: {
                            sequence_order: seq,
                            question: `Sample question ${seq}?`,
                            options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
                        },
                    })
                }
                if (url === '/quiz/status') {
                    return Promise.resolve({ data: { status: 'not_started', started: false, completed: false } })
                }
                return Promise.reject(new Error('Unknown endpoint'))
            })

            vi.mocked(api.default.post).mockImplementation((url: string, body?: any) => {
                if (url === '/quiz/start') {
                    return Promise.resolve({ data: { message: 'Quiz started', total_questions: 10 } })
                }
                if (url === '/quiz/answer') {
                    if (body.sequence_order === 10) {
                        return Promise.resolve({ data: { message: 'Answer recorded', score: 8, completed_at: new Date().toISOString(), duration_seconds: 300 } })
                    }
                    return Promise.resolve({ data: { message: 'Answer recorded' } })
                }
                return Promise.reject(new Error('Unknown endpoint'))
            })

            renderWithProviders(<App />, {
                route: '/quiz',
                includeRouter: false,
                authState: {
                    user: { id: 'test', email: 'test@test.com', name: 'Test', employee_id: 'EMP001' },
                    token: 'test-token',
                    quizStatus: { started: false, completed: false },
                },
            })

            await waitFor(() => {
                expect(screen.getByText('Ready?')).toBeInTheDocument()
            })

            const startButton = screen.getByRole('button', { name: /start/i })
            fireEvent.click(startButton)

            await waitFor(() => {
                expect(screen.getByText('Question 1 of 10')).toBeInTheDocument()
            })

            for (let i = 1; i <= 9; i++) {
                const optionA = screen.getByText(/^A\./)
                fireEvent.click(optionA)

                const nextButton = screen.getByRole('button', { name: /next/i })
                fireEvent.click(nextButton)

                await waitFor(() => {
                    expect(screen.getByText(`Question ${i + 1} of 10`)).toBeInTheDocument()
                })
            }

            const optionA = screen.getByText(/^A\./)
            fireEvent.click(optionA)

            const submitButton = screen.getByRole('button', { name: /submit/i })
            fireEvent.click(submitButton)

            await waitFor(() => {
                expect(screen.getByText(/scored 8 out of 10/i)).toBeInTheDocument()
            }, { timeout: 3000 })
        })
    })

    describe('Session Resumption', () => {
        it('mid-quiz state → status returns current_sequence: 5 → resume at Q5', async () => {
            const api = await import('../api/client')

            vi.mocked(api.default.get).mockResolvedValueOnce({
                data: { started: true, completed: false, current_sequence: 5 },
            })

            vi.mocked(api.default.get).mockResolvedValueOnce({
                data: {
                    sequence_order: 5,
                    question: 'Sample question 5?',
                    options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
                },
            })

            renderWithProviders(<App />, {
                route: '/quiz',
                includeRouter: false,
                authState: {
                    user: { id: 'test', email: 'test@test.com', name: 'Test', employee_id: 'EMP001' },
                    token: 'test-token',
                    quizStatus: { started: true, completed: false, current_sequence: 5 },
                },
            })

            await waitFor(() => {
                expect(screen.getByText('Question 5 of 10')).toBeInTheDocument()
            })
        })

        it('completed quiz → status shows completed → shows results', async () => {
            renderWithProviders(<App />, {
                route: '/quiz',
                includeRouter: false,
                authState: {
                    user: { id: 'test', email: 'test@test.com', name: 'Test', employee_id: 'EMP001' },
                    token: 'test-token',
                    quizStatus: { started: true, completed: true, score: 8 },
                },
            })

            await waitFor(() => {
                expect(screen.getByText('Quiz Completed!')).toBeInTheDocument()
            })
        })
    })

    describe('Error Handling', () => {
        it('403 deadline response shows "Event has concluded" message', async () => {
            const api = await import('../api/client')

            vi.mocked(api.default.get).mockRejectedValue({
                response: { status: 403, data: { error: 'Event has concluded' } },
                message: 'Forbidden',
            })

            renderWithProviders(<App />, {
                route: '/',
                includeRouter: false,
                authState: {
                    user: { id: 'test', email: 'test@test.com', name: 'Test', employee_id: 'EMP001' },
                    token: 'test-token',
                },
            })

            await waitFor(() => {
                expect(screen.getByText('Event has concluded')).toBeInTheDocument()
            })
        })

        it('network error shows retry option', async () => {
            const api = await import('../api/client')

            vi.mocked(api.default.get).mockRejectedValue(new Error('Network Error'))

            renderWithProviders(<App />, {
                route: '/quiz',
                includeRouter: false,
                authState: {
                    user: { id: 'test', email: 'test@test.com', name: 'Test', employee_id: 'EMP001' },
                    token: 'test-token',
                    quizStatus: { started: false, completed: false },
                },
            })

            await waitFor(() => {
                expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
            })

            const retryButton = screen.getByRole('button', { name: /retry/i })
            expect(retryButton).toBeInTheDocument()
        })
    })

    describe('Route Protection', () => {
        it('unauthenticated access to /quiz redirects to /', () => {
            renderWithProviders(<App />, { route: '/quiz', includeRouter: false })

            expect(screen.getByText('NanoQuiz')).toBeInTheDocument()
        })

        it('authenticated user without employee_id accessing /quiz redirects to /onboard', () => {
            renderWithProviders(<App />, {
                route: '/quiz',
                includeRouter: false,
                authState: {
                    user: { id: 'test', email: 'test@test.com', name: 'Test', employee_id: null },
                    token: 'test-token',
                },
            })

            expect(screen.getByText('Enter your Employee ID to continue')).toBeInTheDocument()
        })

        it('quiz not started accessing /quiz/:sequence redirects to /quiz', () => {
            renderWithProviders(<App />, {
                route: '/quiz/1',
                includeRouter: false,
                authState: {
                    user: { id: 'test', email: 'test@test.com', name: 'Test', employee_id: 'EMP001' },
                    token: 'test-token',
                    quizStatus: { started: false, completed: false },
                },
            })

            expect(screen.getByText('Ready?')).toBeInTheDocument()
        })

        it('quiz not completed accessing /quiz/complete redirects to /quiz', () => {
            renderWithProviders(<App />, {
                route: '/quiz/complete',
                includeRouter: false,
                authState: {
                    user: { id: 'test', email: 'test@test.com', name: 'Test', employee_id: 'EMP001' },
                    token: 'test-token',
                    quizStatus: { started: true, completed: false },
                },
            })

            expect(screen.getByText('Ready?')).toBeInTheDocument()
        })
    })
})