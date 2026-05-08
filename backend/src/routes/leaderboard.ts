import { Router, type Request, type Response } from 'express'
import { query } from '../db/index.js'
import { logger } from '../utils/logger.js'

const router = Router()

router.get('/api/leaderboard', async (_req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT ROW_NUMBER() OVER (ORDER BY score DESC, duration_seconds ASC)::int AS rank,
                    name, employee_id, score, duration_seconds
             FROM users
             WHERE completed_at IS NOT NULL
             ORDER BY rank`,
        )

        const leaderboard = result.rows.map((row) => ({
            rank: row.rank,
            name: row.name,
            employee_id: row.employee_id,
            score: row.score,
            duration_seconds: row.duration_seconds,
        }))

        res.json(leaderboard)
    } catch (err) {
        logger.error('Leaderboard error', { error: String(err) })
        res.status(500).json({ error: 'Failed to fetch leaderboard' })
    }
})

export default router
