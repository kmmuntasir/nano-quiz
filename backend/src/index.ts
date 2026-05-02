import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import healthRouter from './routes/health.js'

const app = express()
const PORT = Number(process.env.PORT) || 3000

app.use(cors({ origin: process.env.FRONTEND_URL }))
app.use(morgan('dev'))
app.use(express.json())

app.use(healthRouter)

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

export default app
