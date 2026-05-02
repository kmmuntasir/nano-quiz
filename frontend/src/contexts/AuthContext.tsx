import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'
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
    started_at?: string
    completed_at?: string
    duration_seconds?: number
}

interface AuthState {
    user: User | null
    token: string | null
    isAuthenticated: boolean
    hasOnboarded: boolean
    quizStatus: QuizStatus | null
    loading: boolean
    login: (googleToken: string) => Promise<void>
    logout: () => void
    setOnboarded: (employeeId: string) => void
    refreshQuizStatus: () => Promise<QuizStatus | null>
}

export const AuthContext = createContext<AuthState | null>(null)

const STORAGE_KEYS = {
    token: 'token',
    user: 'user',
} as const

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.user)
        return stored ? JSON.parse(stored) : null
    })
    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem(STORAGE_KEYS.token)
    )
    const [quizStatus, setQuizStatus] = useState<QuizStatus | null>(null)
    const [loading, setLoading] = useState(true)

    const isAuthenticated = !!token && !!user
    const hasOnboarded = !!user?.employee_id

    // Fetch quiz status on mount if authenticated
    useEffect(() => {
        if (!token) {
            setLoading(false)
            return
        }

        api
            .get<{ started: boolean; completed: boolean; current_sequence?: number }>('/quiz/status')
            .then((res) => {
                setQuizStatus(res.data)
            })
            .catch(() => {
                // Status fetch failure shouldn't block the app
            })
            .finally(() => {
                setLoading(false)
            })
    }, [token])

    const login = useCallback(async (googleToken: string) => {
        const res = await api.post<{
            token: string
            user: User
            onboarding_required: boolean
        }>('/auth/google', { token: googleToken })

        const { token: appToken, user: userData } = res.data

        localStorage.setItem(STORAGE_KEYS.token, appToken)
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData))
        setToken(appToken)
        setUser(userData)
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_KEYS.token)
        localStorage.removeItem(STORAGE_KEYS.user)
        setToken(null)
        setUser(null)
        setQuizStatus(null)
    }, [])

    const setOnboarded = useCallback((employeeId: string) => {
        setUser((prev) => {
            if (!prev) return prev
            const updated = { ...prev, employee_id: employeeId }
            localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updated))
            return updated
        })
    }, [])

    const refreshQuizStatus = useCallback(async (): Promise<QuizStatus | null> => {
        try {
            const res = await api.get<QuizStatus>('/quiz/status')
            setQuizStatus(res.data)
            return res.data
        } catch {
            return null
        }
    }, [])

    const value = useMemo<AuthState>(
        () => ({
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
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [user, token, isAuthenticated, hasOnboarded, quizStatus, loading]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
