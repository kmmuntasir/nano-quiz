import { useCallback, useEffect, useState } from 'react'
import api, { ApiError } from '../api/client'
import ErrorMessage from './ErrorMessage'

interface QuestionData {
    sequence_order: number
    question: string
    options: {
        A: string
        B: string
        C: string
        D: string
    }
}

interface QuestionDisplayProps {
    sequence: number
    onAnswer: (sequence: number, selectedOption: string) => void
    onSequenceMismatch?: (correctSequence: number) => void
}

const TOTAL_QUESTIONS = 10

export default function QuestionDisplay({
    sequence,
    onAnswer,
    onSequenceMismatch,
}: QuestionDisplayProps) {
    const [question, setQuestion] = useState<QuestionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selected, setSelected] = useState<string | null>(null)

    useEffect(() => {
        setSelected(null)
        setError(null)
        setLoading(true)

        api.get<QuestionData>(`/quiz/question/${sequence}`)
            .then((res) => setQuestion(res.data))
            .catch((err) => {
                if (err instanceof ApiError && err.status === 403) {
                    onSequenceMismatch?.(sequence)
                    return
                }
                setError(err instanceof Error ? err.message : 'Failed to load question.')
            })
            .finally(() => setLoading(false))
    }, [sequence, onSequenceMismatch])

    const handleSubmit = useCallback(() => {
        if (!selected) return
        console.log(`Answer submitted: sequence=${sequence}, option=${selected}`)
        onAnswer(sequence, selected)
    }, [selected, sequence, onAnswer])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        )
    }

    if (error) {
        return <ErrorMessage message={error} onRetry={() => window.location.reload()} />
    }

    if (!question) return null

    const isLast = sequence === TOTAL_QUESTIONS
    const options: [string, string][] = Object.entries(question.options)

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface px-4">
            <div className="w-full max-w-lg">
                <p className="text-sm text-text-secondary mb-2 text-center">
                    Question {sequence} of {TOTAL_QUESTIONS}
                </p>
                <div className="w-full bg-primary-100 rounded-full h-2 mb-8">
                    <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(sequence / TOTAL_QUESTIONS) * 100}%` }}
                    />
                </div>
                <h1 className="text-xl font-semibold text-text-primary mb-6 text-center">
                    {question.question}
                </h1>
                <div className="space-y-3">
                    {options.map(([letter, text]) => (
                        <button
                            key={letter}
                            onClick={() => setSelected(letter)}
                            className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                                selected === letter
                                    ? 'border-primary bg-primary-50 text-primary-700'
                                    : 'border-gray-200 bg-surface-card hover:border-gray-300 text-text-primary'
                            }`}
                        >
                            <span className="font-semibold mr-3">{letter}.</span>
                            {text}
                        </button>
                    ))}
                </div>
                <div className="mt-6 text-center">
                    <button
                        onClick={handleSubmit}
                        disabled={!selected}
                        className="px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLast ? 'Submit' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    )
}
