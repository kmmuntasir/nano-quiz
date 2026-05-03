import { type ReactElement, type ReactNode, useState, useCallback } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter, type RouteObject } from 'react-router-dom'
import { AuthContext, type AuthState } from '../contexts/AuthContext'
import api from '../api/client'

interface User {
    id: string
    email: string
    name: string
    employee_id: string | null
}

interface QuizStatus {
    started: boolean
    completed: boolean
    current_sequence?: number
    score?: number
}

export interface MockAuthState {
    user?: User | null
    token?: string | null
    quizStatus?: QuizStatus | null
    loading?: boolean
}

export function TestAuthProvider({ children, initialState = {} }: { children: ReactNode; initialState?: MockAuthState }) {
    const [user, setUser] = useState<User | null>(initialState.user ?? null)
    const [token, setToken] = useState<string | null>(initialState.token ?? null)
    const [quizStatus, setQuizStatus] = useState<QuizStatus | null>(initialState.quizStatus ?? null)
    const [loading, setLoading] = useState(initialState.loading ?? false)

    const isAuthenticated = !!token && !!user
    const hasOnboarded = !!user?.employee_id

    const login = useCallback(async (googleToken: string) => {
        const res = await api.post<{
            token: string
            user: User
            onboarding_required: boolean
        }>('/auth/google', { token: googleToken })

        const { token: appToken, user: userData, onboarding_required } = res.data

        localStorage.setItem('token', appToken)
        localStorage.setItem('user', JSON.stringify(userData))
        setToken(appToken)
        setUser(userData)

        return onboarding_required
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
        setQuizStatus(null)
    }, [])
    const setOnboarded = useCallback((employeeId: string) => {
        setUser((prev) => prev ? { ...prev, employee_id: employeeId } : prev)
    }, [])
    const refreshQuizStatus = useCallback(async () => quizStatus, [quizStatus])

    const value: AuthState = {
        user,
        token,
        isAuthenticated,
        hasOnboarded,
        quizStatus,
        loading,
        login,
        logout,
        setOnboarded,
        refreshQuizStatus,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    route?: string
    routes?: RouteObject[]
    authState?: MockAuthState
    includeRouter?: boolean
}

function TestProviders({ children, route = '/', routes, authState, includeRouter = true }: {
    children: ReactNode
    route?: string
    routes?: RouteObject[]
    authState?: MockAuthState
    includeRouter?: boolean
}) {
    const content = (
        <TestAuthProvider initialState={authState}>
            {children}
        </TestAuthProvider>
    )

    if (!includeRouter) {
        return content
    }

    const routerProps = routes
        ? { initialEntries: [route], children: content }
        : { initialEntries: [route], children: content }

    return (
        <MemoryRouter {...routerProps}>
            {content}
        </MemoryRouter>
    )
}

export function renderWithProviders(
    ui: ReactElement,
    options: CustomRenderOptions = {},
) {
    const { route, routes, authState, includeRouter = true, ...renderOptions } = options

    return render(ui, {
        wrapper: ({ children }) => (
            <TestProviders route={route} routes={routes} authState={authState} includeRouter={includeRouter}>
                {children}
            </TestProviders>
        ),
        ...renderOptions,
    })
}

export { render }
export default renderWithProviders
