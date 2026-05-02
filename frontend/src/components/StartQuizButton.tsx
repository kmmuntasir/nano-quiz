import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import ErrorMessage from './ErrorMessage'

export default function StartQuizButton() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()
    const { refreshQuizStatus } = useAuth()

    const handleStart = async () => {
        setLoading(true)
        setError(null)
        try {
            await api.post('/quiz/start')
            const status = await refreshQuizStatus()
            if (status?.current_sequence) {
                navigate(`/quiz/${status.current_sequence}`, { replace: true })
            } else {
                navigate('/quiz/1', { replace: true })
            }
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Failed to start quiz. Please try again.'
            setError(message)
            setLoading(false)
        }
    }

    if (error) {
        return <ErrorMessage message={error} onRetry={handleStart} retryLabel="Try Again" />
    }

    return (
        <button
            onClick={handleStart}
            disabled={loading}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
            {loading && (
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            )}
            {loading ? 'Starting...' : 'Start Quiz'}
        </button>
    )
}
