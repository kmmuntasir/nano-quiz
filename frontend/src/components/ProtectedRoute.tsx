import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

interface ProtectedRouteProps {
    children: ReactNode
    requireEmployeeId?: boolean
    requireQuizStarted?: boolean
    requireQuizCompleted?: boolean
}

// Temporary auth check until AuthContext is built in T3
function getAuthState() {
    const token = localStorage.getItem('token')
    const employeeId = localStorage.getItem('employee_id')
    const quizCompleted = localStorage.getItem('quiz_completed') === 'true'
    const quizStarted = localStorage.getItem('quiz_started') === 'true'
    return { isAuthenticated: !!token, hasEmployeeId: !!employeeId, quizStarted, quizCompleted }
}

export default function ProtectedRoute({
    children,
    requireEmployeeId,
    requireQuizStarted,
    requireQuizCompleted,
}: ProtectedRouteProps) {
    const { isAuthenticated, hasEmployeeId, quizStarted, quizCompleted } = getAuthState()
    const location = useLocation()

    if (!isAuthenticated) {
        return <Navigate to="/" state={{ from: location }} replace />
    }

    if (!hasEmployeeId && requireEmployeeId) {
        return <Navigate to="/onboard" replace />
    }

    if (requireQuizStarted && !quizStarted) {
        return <Navigate to="/quiz" replace />
    }

    if (requireQuizCompleted && !quizCompleted) {
        return <Navigate to="/quiz" replace />
    }

    // Redirect away from onboarding if already completed
    if (hasEmployeeId && location.pathname === '/onboard') {
        return <Navigate to="/quiz" replace />
    }

    return <>{children}</>
}
