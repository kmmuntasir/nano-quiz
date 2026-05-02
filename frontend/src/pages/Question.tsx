import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QuestionDisplay from '../components/QuestionDisplay'

export default function Question() {
    const { sequence: sequenceParam } = useParams<{ sequence: string }>()
    const navigate = useNavigate()
    const sequence = Number(sequenceParam)

    const handleAnswer = useCallback(
        (_sequence: number, _selectedOption: string) => {
            const next = _sequence + 1
            if (next > 10) {
                navigate('/quiz/complete', { replace: true })
            } else {
                navigate(`/quiz/${next}`, { replace: true })
            }
        },
        [navigate],
    )

    const handleSequenceMismatch = useCallback(
        (attempted: number) => {
            navigate(`/quiz/${attempted}`, { replace: true })
        },
        [navigate],
    )

    if (!sequenceParam || Number.isNaN(sequence) || sequence < 1 || sequence > 10) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <p className="text-text-secondary">Invalid question sequence.</p>
            </div>
        )
    }

    return (
        <QuestionDisplay
            sequence={sequence}
            onAnswer={handleAnswer}
            onSequenceMismatch={handleSequenceMismatch}
        />
    )
}
