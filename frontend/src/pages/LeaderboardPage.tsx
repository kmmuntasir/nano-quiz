import { useCallback, useEffect, useRef, useState } from 'react'
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

const REFRESH_INTERVAL_MS = 30_000

export default function LeaderboardPage() {
    const { user } = useAuth()
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetchLeaderboard = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true)
        } else {
            setLoading(true)
        }
        setError(null)

        try {
            const res = await api.get<LeaderboardEntry[]>('/leaderboard')
            setEntries(res.data)
        } catch {
            setError('Failed to load leaderboard.')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        fetchLeaderboard()

        intervalRef.current = setInterval(() => {
            fetchLeaderboard(true)
        }, REFRESH_INTERVAL_MS)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [fetchLeaderboard])

    const handleManualRefresh = () => {
        fetchLeaderboard(true)
    }

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
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-primary text-center flex-1">
                        Leaderboard
                    </h1>
                    <button
                        onClick={handleManualRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary-50 rounded-lg hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <svg
                            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>

                {refreshing && (
                    <div className="mb-4 h-1 bg-primary-100 rounded overflow-hidden">
                        <div className="h-full bg-primary animate-pulse" />
                    </div>
                )}

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
