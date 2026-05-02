import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express, { Express } from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { authenticate, type AuthenticatedRequest } from './auth.js'

describe('authenticate middleware', () => {
    let app: Express
    const originalJwtSecret = process.env.JWT_SECRET
    const SECRET = 'test-jwt-secret'

    beforeEach(() => {
        process.env.JWT_SECRET = SECRET
        app = express()
        app.use('/api', authenticate)
        app.get('/api/protected', (req, res) =>
            res.json({ userId: (req as AuthenticatedRequest).userId }),
        )
    })

    afterEach(() => {
        if (originalJwtSecret !== undefined) {
            process.env.JWT_SECRET = originalJwtSecret
        } else {
            delete process.env.JWT_SECRET
        }
    })

    it('allows valid Bearer token', async () => {
        const token = jwt.sign({ userId: 'user-123' }, SECRET, { expiresIn: '2h' })

        const res = await request(app)
            .get('/api/protected')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(200)
        expect(res.body.userId).toBe('user-123')
    })

    it('rejects missing Authorization header with 401', async () => {
        const res = await request(app).get('/api/protected')

        expect(res.status).toBe(401)
        expect(res.body.error).toContain('Missing')
    })

    it('rejects malformed Authorization header with 401', async () => {
        const res = await request(app)
            .get('/api/protected')
            .set('Authorization', 'Token abc123')

        expect(res.status).toBe(401)
        expect(res.body.error).toContain('Missing')
    })

    it('rejects invalid token with 401', async () => {
        const res = await request(app)
            .get('/api/protected')
            .set('Authorization', 'Bearer not.a.real.token')

        expect(res.status).toBe(401)
        expect(res.body.error).toContain('Invalid')
    })

    it('rejects token signed with wrong secret with 401', async () => {
        const token = jwt.sign({ userId: 'user-123' }, 'wrong-secret', {
            expiresIn: '2h',
        })

        const res = await request(app)
            .get('/api/protected')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(401)
        expect(res.body.error).toContain('Invalid')
    })

    it('rejects expired token with 401', async () => {
        const token = jwt.sign({ userId: 'user-123' }, SECRET, {
            expiresIn: '-1s',
        })

        const res = await request(app)
            .get('/api/protected')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(401)
        expect(res.body.error).toContain('expired')
    })
})
