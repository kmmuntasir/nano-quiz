import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../api/client'

export default function Onboarding() {
    const { user, setOnboarded } = useAuth()
    const navigate = useNavigate()
    const [employeeId, setEmployeeId] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)

        const trimmed = employeeId.trim()
        if (!trimmed) {
            setError('Employee ID is required.')
            return
        }

        setLoading(true)
        try {
            await api.post('/auth/onboard', { employee_id: trimmed })
            setOnboarded(trimmed)
            navigate('/quiz', { replace: true })
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Something went wrong. Please try again.'
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="bg-surface-card rounded-xl shadow-lg p-8 max-w-sm w-full text-center">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-primary">Welcome, {user?.name}!</h1>
                    <p className="text-text-secondary mt-2">Enter your Employee ID to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        type="text"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        placeholder="Employee ID"
                        disabled={loading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-center"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                        {loading ? 'Saving...' : 'Continue'}
                    </button>
                </form>

                {error && <p className="mt-4 text-sm text-error">{error}</p>}
            </div>
        </div>
    )
}
