import { Router, type Request, type Response } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import { query } from '../db/index.js'

const router = Router()

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

interface AuthRequestBody {
    token: string
}

router.post('/api/auth/google', async (req: Request, res: Response) => {
    try {
        const { token } = req.body as AuthRequestBody

        if (!token) {
            res.status(400).json({ error: 'Token is required' })
            return
        }

        // Verify Google JWT
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        })
        const payload = ticket.getPayload()

        if (!payload?.sub || !payload?.email || !payload?.name) {
            res.status(401).json({ error: 'Invalid Google token' })
            return
        }

        const googleId = payload.sub
        const email = payload.email
        const name = payload.name

        // Domain restriction
        const restrictDomain = process.env.RESTRICT_DOMAIN
        if (restrictDomain) {
            const emailDomain = email.split('@')[1]
            if (emailDomain !== restrictDomain) {
                res.status(403).json({ error: `Email domain must be @${restrictDomain}` })
                return
            }
        }

        // Upsert user by google_id
        const result = await query(
            `INSERT INTO users (google_id, email, name)
             VALUES ($1, $2, $3)
             ON CONFLICT (google_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
             RETURNING id, email, name, employee_id`,
            [googleId, email, name],
        )

        const user = result.rows[0]

        // Issue app JWT
        const appToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
            expiresIn: '2h',
        })

        res.json({
            token: appToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                employee_id: user.employee_id,
            },
            onboarding_required: user.employee_id === null,
        })
    } catch (err) {
        console.error('Google auth error:', err)
        res.status(500).json({ error: 'Authentication failed' })
    }
})

export default router
