import { useParams } from 'react-router-dom'

export default function Question() {
    const { sequence } = useParams<{ sequence: string }>()

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-primary mb-4">
                    Question {sequence}
                </h1>
                <p className="text-secondary">Loading question...</p>
            </div>
        </div>
    )
}
