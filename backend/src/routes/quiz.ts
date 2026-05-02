import { Router, type Response } from 'express'
import { query, getClient } from '../db/index.js'
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

router.post('/api/quiz/start', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!

    try {
        // Check onboarding
        const { rows: userRows } = await query<{ employee_id: string | null; started_at: string | null }>(
            'SELECT employee_id, started_at FROM users WHERE id = $1',
            [userId],
        )

        if (userRows.length === 0) {
            res.status(404).json({ error: 'User not found' })
            return
        }

        if (userRows[0].employee_id === null) {
            res.status(403).json({ error: 'Onboarding required before starting quiz' })
            return
        }

        // Idempotent: return existing session if already started
        if (userRows[0].started_at !== null) {
            const { rows: sessions } = await query<{ sequence_order: number; question_id: string }>(
                'SELECT sequence_order, question_id FROM user_sessions WHERE user_id = $1 ORDER BY sequence_order',
                [userId],
            )
            res.json({
                message: 'Quiz already started',
                started_at: userRows[0].started_at,
                total_questions: sessions.length,
            })
            return
        }

        // Validate question availability before transaction
        const { rows: counts } = await query<{ category: string; count: string }>(
            'SELECT category, COUNT(*)::text AS count FROM questions GROUP BY category',
        )
        const faqCount = Number(counts.find((r) => r.category === 'faq')?.count ?? 0)
        const triviaCount = Number(counts.find((r) => r.category === 'trivia')?.count ?? 0)

        if (faqCount < 6 || triviaCount < 4) {
            res.status(503).json({
                error: 'Insufficient questions available',
                detail: { faq_required: 6, faq_available: faqCount, trivia_required: 4, trivia_available: triviaCount },
            })
            return
        }

        // Allocate questions in transaction
        const client = await getClient()
        try {
            await client.query('BEGIN')

            const updateResult = await client.query<{ started_at: string }>(
                'UPDATE users SET started_at = NOW() WHERE id = $1 AND started_at IS NULL RETURNING started_at',
                [userId],
            )

            if (updateResult.rowCount === 0) {
                await client.query('ROLLBACK')

                const { rows: existing } = await query<{ started_at: string }>(
                    'SELECT started_at FROM users WHERE id = $1',
                    [userId],
                )
                const { rows: sessions } = await query<{ sequence_order: number }>(
                    'SELECT sequence_order FROM user_sessions WHERE user_id = $1 ORDER BY sequence_order',
                    [userId],
                )
                res.json({
                    message: 'Quiz already started',
                    started_at: existing[0]?.started_at ?? null,
                    total_questions: sessions.length,
                })
                return
            }

            await client.query(
                `WITH selected_faq AS (
                    SELECT id FROM questions WHERE category = 'faq' ORDER BY RANDOM() LIMIT 6
                ),
                selected_trivia AS (
                    SELECT id FROM questions WHERE category = 'trivia' ORDER BY RANDOM() LIMIT 4
                ),
                all_questions AS (
                    SELECT id FROM selected_faq
                    UNION ALL
                    SELECT id FROM selected_trivia
                ),
                shuffled AS (
                    SELECT id, ROW_NUMBER() OVER (ORDER BY RANDOM()) AS seq
                    FROM all_questions
                )
                INSERT INTO user_sessions (user_id, question_id, sequence_order)
                SELECT $1, id, seq FROM shuffled`,
                [userId],
            )

            await client.query('COMMIT')

            const startedAt = updateResult.rows[0].started_at

            res.json({
                message: 'Quiz started',
                started_at: startedAt,
                total_questions: 10,
            })
        } catch (err) {
            await client.query('ROLLBACK')
            throw err
        } finally {
            client.release()
        }
    } catch (err) {
        console.error('Quiz start error:', err)
        res.status(500).json({ error: 'Failed to start quiz' })
    }
})

router.get('/api/quiz/question/:sequence', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.userId!
        const sequence = Number(req.params.sequence)

        if (!Number.isInteger(sequence) || sequence < 1 || sequence > 10) {
            res.status(404).json({ error: 'Invalid sequence number. Must be between 1 and 10.' })
            return
        }

        // Check sequential access: find first unanswered question
        const { rows: seqRows } = await query<{ current_seq: number | null }>(
            'SELECT MIN(sequence_order) AS current_seq FROM user_sessions WHERE user_id = $1 AND user_answer IS NULL',
            [userId],
        )

        const currentSeq = seqRows[0]?.current_seq ?? null

        if (currentSeq === null) {
            res.status(403).json({ error: 'Quiz already completed' })
            return
        }

        if (sequence !== currentSeq) {
            res.status(403).json({ error: `Must answer question ${currentSeq} first` })
            return
        }

        // Fetch question, excluding correct_opt
        const { rows } = await query<{
            sequence_order: number
            question_text: string
            opt_a: string
            opt_b: string
            opt_c: string
            opt_d: string
        }>(
            `SELECT us.sequence_order, q.question_text, q.opt_a, q.opt_b, q.opt_c, q.opt_d
             FROM user_sessions us
             JOIN questions q ON q.id = us.question_id
             WHERE us.user_id = $1 AND us.sequence_order = $2`,
            [userId, sequence],
        )

        if (rows.length === 0) {
            res.status(404).json({ error: 'Question not found' })
            return
        }

        const row = rows[0]

        // Per-question timing: set viewed_at on first fetch
        if (process.env.TRACK_PER_QUESTION_TIME === 'true') {
            await query(
                'UPDATE user_sessions SET viewed_at = NOW() WHERE user_id = $1 AND sequence_order = $2 AND viewed_at IS NULL',
                [userId, sequence],
            )
        }

        res.json({
            sequence_order: row.sequence_order,
            question: row.question_text,
            options: {
                A: row.opt_a,
                B: row.opt_b,
                C: row.opt_c,
                D: row.opt_d,
            },
        })
    } catch (err) {
        console.error('Get question error:', err)
        res.status(500).json({ error: 'Failed to fetch question' })
    }
})

export default router
