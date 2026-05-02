import { Router, type Request, type Response } from 'express'
import { query } from '../db/index.js'

const router = Router()

router.get('/api/leaderboard', async (_req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT name, employee_id, score, duration_seconds
             FROM users
             WHERE completed_at IS NOT NULL
             ORDER BY score DESC, duration_seconds ASC`,
        )

        const leaderboard = result.rows.map((row, index) => ({
            rank: index + 1,
            name: row.name,
            employee_id: row.employee_id,
            score: row.score,
            duration_seconds: row.duration_seconds,
        }))

        res.json(leaderboard)
    } catch (err) {
        console.error('Leaderboard error:', err)
        res.status(500).json({ error: 'Failed to fetch leaderboard' })
    }
})

export default router
