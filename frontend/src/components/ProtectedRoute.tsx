import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface ProtectedRouteProps {
    children: ReactNode
    requireEmployeeId?: boolean
    requireQuizStarted?: boolean
    requireQuizCompleted?: boolean
}

export default function ProtectedRoute({
    children,
    requireEmployeeId,
    requireQuizStarted,
    requireQuizCompleted,
}: ProtectedRouteProps) {
    const { isAuthenticated, hasOnboarded, quizStatus, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/" state={{ from: location }} replace />
    }

    if (requireEmployeeId && !hasOnboarded) {
        return <Navigate to="/onboard" replace />
    }

    if (requireQuizStarted && !quizStatus?.started) {
        return <Navigate to="/quiz" replace />
    }

    if (requireQuizCompleted && !quizStatus?.completed) {
        return <Navigate to="/quiz" replace />
    }

    if (hasOnboarded && location.pathname === '/onboard') {
        return <Navigate to="/quiz" replace />
    }

    return <>{children}</>
}
