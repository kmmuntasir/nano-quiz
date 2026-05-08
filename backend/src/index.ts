import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import morgan from 'morgan'
import healthRouter from './routes/health.js'
import { closePool } from './db/index.js'
import authRouter from './routes/auth.js'
import quizRouter from './routes/quiz.js'
import leaderboardRouter from './routes/leaderboard.js'
import { corsHandler, preflightHandler } from './middleware/cors.js'
import { authenticate } from './middleware/auth.js'
import { logger } from './utils/logger.js'

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(preflightHandler)
app.use(corsHandler)
app.use(morgan('combined', { stream: { write: (msg: string) => logger.info(msg.trim(), { source: 'http' }) } }))
app.use(express.json())

app.use(authRouter)
app.use('/api', authenticate)
app.use(quizRouter)
app.use(leaderboardRouter)
app.use(healthRouter)

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(err.message, { stack: err.stack })
    res.status(500).json({ error: 'Internal server error' })
})

const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`)
})

process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down')
    server.close()
    await closePool()
    process.exit(0)
})

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down')
    server.close()
    await closePool()
    process.exit(0)
})

export default app
