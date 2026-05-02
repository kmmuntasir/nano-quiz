import { useEffect, useState } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'

interface LeaderboardEntry {
    rank: number
    name: string
    employee_id: string
    score: number
    duration_seconds: number
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

export default function LeaderboardPage() {
    const { user } = useAuth()
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        api.get<LeaderboardEntry[]>('/leaderboard')
            .then((res) => setEntries(res.data))
            .catch(() => setError('Failed to load leaderboard.'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <p className="text-red-500">{error}</p>
            </div>
        )
    }

    if (entries.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-primary mb-4">
                        Leaderboard
                    </h1>
                    <p className="text-secondary">
                        No scores yet. Be the first to complete the quiz!
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-surface py-10 px-4">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold text-primary mb-6 text-center">
                    Leaderboard
                </h1>
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="text-left text-sm text-secondary border-b border-gray-200">
                            <th className="pb-2 pr-4">Rank</th>
                            <th className="pb-2 pr-4">Name</th>
                            <th className="pb-2 pr-4">ID</th>
                            <th className="pb-2 pr-4 text-right">Score</th>
                            <th className="pb-2 text-right">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry) => {
                            const isCurrentUser =
                                user?.employee_id === entry.employee_id
                            return (
                                <tr
                                    key={entry.rank}
                                    className={
                                        isCurrentUser
                                            ? 'bg-primary/10 font-semibold'
                                            : ''
                                    }
                                >
                                    <td className="py-2 pr-4">
                                        {entry.rank}
                                    </td>
                                    <td className="py-2 pr-4">
                                        {entry.name}
                                    </td>
                                    <td className="py-2 pr-4">
                                        {entry.employee_id}
                                    </td>
                                    <td className="py-2 pr-4 text-right">
                                        {entry.score}/10
                                    </td>
                                    <td className="py-2 text-right">
                                        {formatDuration(entry.duration_seconds)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
