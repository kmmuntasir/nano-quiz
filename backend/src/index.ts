import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import healthRouter from './routes/health.js'
import { closePool } from './db/index.js'
import authRouter from './routes/auth.js'

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(cors({ origin: process.env.FRONTEND_URL }))
app.use(morgan('dev'))
app.use(express.json())

app.use(healthRouter)
app.use(authRouter)

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down')
    server.close()
    await closePool()
    process.exit(0)
})

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down')
    server.close()
    await closePool()
    process.exit(0)
})

export default app
