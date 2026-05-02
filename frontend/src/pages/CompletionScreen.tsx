import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface CompletionState {
    score?: number
    completed_at?: string
    duration_seconds?: number
}

export default function CompletionScreen() {
    const location = useLocation()
    const { quizStatus, refreshQuizStatus } = useAuth()
    const [score, setScore] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const state = location.state as CompletionState | null

        if (state?.score !== undefined) {
            setScore(state.score)
            setLoading(false)
            return
        }

        if (quizStatus?.score !== undefined) {
            setScore(quizStatus.score)
            setLoading(false)
            return
        }

        refreshQuizStatus().then((status) => {
            if (status?.score !== undefined) {
                setScore(status.score)
            }
            setLoading(false)
        })
    }, [location.state, quizStatus, refreshQuizStatus])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface px-4">
            <div className="w-full max-w-md text-center">
                <div className="mb-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
                        <svg
                            className="w-10 h-10 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-text-primary mb-2">
                    Quiz Complete!
                </h1>

                <p className="text-secondary mb-8">
                    {score !== null
                        ? `You scored ${score} out of 10!`
                        : 'Your responses have been recorded.'}
                </p>

                {score !== null && (
                    <p className="text-sm text-text-secondary mb-8">
                        {score === 10
                            ? 'Perfect score! Outstanding performance!'
                            : score >= 8
                              ? 'Excellent work! You really know your stuff.'
                              : score >= 6
                                ? 'Good job! Keep learning and improving.'
                                : 'Thanks for participating! Every attempt is a learning opportunity.'}
                    </p>
                )}

                <Link
                    to="/leaderboard"
                    className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                    View Leaderboard
                </Link>
            </div>
        </div>
    )
}
