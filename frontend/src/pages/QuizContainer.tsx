import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import StartQuizButton from '../components/StartQuizButton'

export default function QuizContainer() {
    const { quizStatus, refreshQuizStatus, loading } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        refreshQuizStatus()
    }, [refreshQuizStatus])

    useEffect(() => {
        if (quizStatus?.started && !quizStatus.completed && quizStatus.current_sequence) {
            navigate(`/quiz/${quizStatus.current_sequence}`, { replace: true })
        }
    }, [quizStatus, navigate])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        )
    }

    if (quizStatus?.completed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-primary mb-4">
                        Quiz Completed!
                    </h1>
                    {quizStatus.score !== undefined && (
                        <p className="text-lg text-secondary mb-2">
                            Your score: {quizStatus.score}/10
                        </p>
                    )}
                    {quizStatus.duration_seconds !== undefined && (
                        <p className="text-secondary mb-6">
                            Time: {Math.floor(quizStatus.duration_seconds / 60)}m {quizStatus.duration_seconds % 60}s
                        </p>
                    )}
                    <button
                        onClick={() => navigate('/quiz/complete')}
                        className="px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                        View Results
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-primary mb-4">Ready?</h1>
                <p className="text-secondary mb-6">
                    You are about to start the quiz. 10 questions, no going back.
                </p>
                <StartQuizButton />
            </div>
        </div>
    )
}
