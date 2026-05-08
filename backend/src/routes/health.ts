import { Router, type Request, type Response } from 'express'
import { query } from '../db/index.js'

const router = Router()

router.get('/health', async (_req: Request, res: Response) => {
    try {
        await query('SELECT 1')
        res.json({ status: 'healthy', database: 'connected' })
    } catch {
        res.status(503).json({ status: 'unhealthy' })
    }
})

export default router
