import { Router, type Request, type Response } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import { query } from '../db/index.js'

const router = Router()

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

interface JwtPayload {
    userId: string
}

function extractUserId(req: Request, res: Response): string | null {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' })
        return null
    }

    const token = authHeader.slice(7)
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
        return payload.userId
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' })
        return null
    }
}

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
        let ticket
        try {
            ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            })
        } catch {
            res.status(401).json({ error: 'Invalid Google token' })
            return
        }
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

router.post('/api/auth/onboard', async (req: Request, res: Response) => {
    try {
        const userId = extractUserId(req, res)
        if (!userId) return

        const { employee_id } = req.body as { employee_id?: string }

        if (!employee_id || !employee_id.trim()) {
            res.status(400).json({ error: 'Employee ID is required' })
            return
        }

        // Check uniqueness (exclude current user)
        const existing = await query(
            'SELECT id FROM users WHERE employee_id = $1 AND id != $2',
            [employee_id.trim(), userId],
        )
        if (existing.rowCount && existing.rowCount > 0) {
            res.status(409).json({ error: 'Employee ID is already taken' })
            return
        }

        // Update only if user doesn't already have an employee_id
        const result = await query(
            'UPDATE users SET employee_id = $1 WHERE id = $2 AND employee_id IS NULL RETURNING id, email, name, employee_id',
            [employee_id.trim(), userId],
        )

        if (!result.rowCount || result.rowCount === 0) {
            res.status(409).json({ error: 'Employee ID already set. Re-onboarding is not allowed.' })
            return
        }

        const user = result.rows[0]
        res.json({
            message: 'Onboarding complete',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                employee_id: user.employee_id,
            },
        })
    } catch (err) {
        console.error('Onboard error:', err)
        res.status(500).json({ error: 'Onboarding failed' })
    }
})

export default router
