import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express, { Express } from 'express'
import request from 'supertest'
import { corsHandler, preflightHandler } from './cors.js'

describe('CORS middleware', () => {
    let app: Express
    const originalFrontendUrl = process.env.FRONTEND_URL

    beforeEach(() => {
        app = express()
        app.use(preflightHandler)
        app.use(corsHandler)
        app.get('/test', (_req, res) => res.json({ ok: true }))
    })

    afterEach(() => {
        if (originalFrontendUrl !== undefined) {
            process.env.FRONTEND_URL = originalFrontendUrl
        } else {
            delete process.env.FRONTEND_URL
        }
    })

    describe('dev mode (no FRONTEND_URL)', () => {
        beforeEach(() => {
            delete process.env.FRONTEND_URL
        })

        it('allows requests with any origin', async () => {
            const res = await request(app)
                .get('/test')
                .set('Origin', 'http://random-site.com')

            expect(res.status).toBe(200)
            expect(res.headers['access-control-allow-origin']).toBe('http://random-site.com')
        })
    })

    describe('production mode (FRONTEND_URL set)', () => {
        const allowed = 'https://quiz.example.com'

        beforeEach(() => {
            process.env.FRONTEND_URL = allowed
        })

        it('allows requests from FRONTEND_URL', async () => {
            const res = await request(app)
                .get('/test')
                .set('Origin', allowed)

            expect(res.status).toBe(200)
            expect(res.headers['access-control-allow-origin']).toBe(allowed)
        })

        it('rejects unauthorized origins with 403', async () => {
            const res = await request(app)
                .get('/test')
                .set('Origin', 'https://evil-site.com')

            expect(res.status).toBe(403)
            expect(res.body.error).toContain('not allowed')
        })

        it('allows requests without origin header', async () => {
            const res = await request(app).get('/test')

            expect(res.status).toBe(200)
        })
    })

    describe('preflight (OPTIONS)', () => {
        it('handles OPTIONS with correct headers', async () => {
            process.env.FRONTEND_URL = 'https://quiz.example.com'

            const res = await request(app)
                .options('/test')
                .set('Origin', 'https://quiz.example.com')

            expect(res.status).toBe(204)
            expect(res.headers['access-control-allow-methods']).toBe('GET, POST, PUT, DELETE, OPTIONS')
            expect(res.headers['access-control-allow-headers']).toBe('Content-Type, Authorization')
            expect(res.headers['access-control-max-age']).toBe('86400')
        })

        it('rejects preflight from unauthorized origin', async () => {
            process.env.FRONTEND_URL = 'https://quiz.example.com'

            const res = await request(app)
                .options('/test')
                .set('Origin', 'https://evil-site.com')

            expect(res.status).toBe(204)
            expect(res.headers['access-control-allow-origin']).toBeUndefined()
        })
    })
})
