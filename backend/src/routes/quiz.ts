import { Router, type Response } from 'express'
import { query } from '../db/index.js'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'

const router = Router()

router.get('/api/quiz/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.userId!

        // Check if user has any session rows
        const sessionCheck = await query(
            'SELECT 1 FROM user_sessions WHERE user_id = $1 LIMIT 1',
            [userId],
        )

        if (sessionCheck.rows.length === 0) {
            res.json({ started: false, completed: false })
            return
        }

        // Find first unanswered question
        const { rows: seqRows } = await query<{ current_sequence: number | null }>(
            'SELECT MIN(sequence_order) AS current_sequence FROM user_sessions WHERE user_id = $1 AND user_answer IS NULL',
            [userId],
        )

        const currentSequence = seqRows[0]?.current_sequence ?? null

        if (currentSequence !== null) {
            // In progress — get started_at from users table
            const { rows: userRows } = await query<{ started_at: string }>(
                'SELECT started_at FROM users WHERE id = $1',
                [userId],
            )
            res.json({
                started: true,
                completed: false,
                current_sequence: currentSequence,
                started_at: userRows[0]?.started_at ?? null,
            })
            return
        }

        // All 10 answered — completed. Fetch user record for score/timestamps.
        const { rows: userRows } = await query<{
            score: number | null
            started_at: string | null
            completed_at: string | null
        }>(
            'SELECT score, started_at, completed_at FROM users WHERE id = $1',
            [userId],
        )

        const user = userRows[0]
        let score = user?.score ?? null
        let completedAt = user?.completed_at ?? null

        // Safety net: recalculate score and set completed_at if missing
        if (score === null || completedAt === null) {
            // Recalculate score by joining user_sessions with questions
            const { rows: scoreRows } = await query<{ score: number }>(
                `SELECT COUNT(*)::int AS score
                 FROM user_sessions us
                 JOIN questions q ON q.id = us.question_id
                 WHERE us.user_id = $1 AND us.user_answer = q.correct_opt`,
                [userId],
            )
            score = scoreRows[0]?.score ?? 0

            // Set completed_at if missing
            if (completedAt === null) {
                const updateResult = await query<{ completed_at: string }>(
                    `UPDATE users SET completed_at = NOW(), score = $2 WHERE id = $1 AND completed_at IS NULL RETURNING completed_at`,
                    [userId, score],
                )
                completedAt = updateResult.rows[0]?.completed_at ?? new Date().toISOString()
            } else {
                // Update score only
                await query('UPDATE users SET score = $2 WHERE id = $1', [userId, score])
            }
        }

        res.json({
            started: true,
            completed: true,
            score,
            started_at: user?.started_at ?? null,
            completed_at: completedAt,
        })
    } catch (err) {
        console.error('Quiz status error:', err)
        res.status(500).json({ error: 'Failed to fetch quiz status' })
    }
})

export default router
