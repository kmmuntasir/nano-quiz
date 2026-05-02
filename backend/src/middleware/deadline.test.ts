import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express, { Express } from 'express'
import request from 'supertest'
import { deadlineCheck } from './deadline.js'

describe('Deadline middleware', () => {
    let app: Express
    const originalDeadline = process.env.EVENT_DEADLINE_ISO

    beforeEach(() => {
        app = express()
    })

    afterEach(() => {
        if (originalDeadline !== undefined) {
            process.env.EVENT_DEADLINE_ISO = originalDeadline
        } else {
            delete process.env.EVENT_DEADLINE_ISO
        }
    })

    describe('no deadline configured', () => {
        beforeEach(() => {
            delete process.env.EVENT_DEADLINE_ISO
            app.use(deadlineCheck)
            app.get('/test', (_req, res) => res.json({ ok: true }))
        })

        it('allows all requests through', async () => {
            const res = await request(app).get('/test')
            expect(res.status).toBe(200)
        })
    })

    describe('before deadline', () => {
        beforeEach(() => {
            process.env.EVENT_DEADLINE_ISO = new Date(Date.now() + 3600000).toISOString()
            app.use(deadlineCheck)
            app.get('/test', (_req, res) => res.json({ ok: true }))
        })

        it('allows request through', async () => {
            const res = await request(app).get('/test')
            expect(res.status).toBe(200)
        })
    })

    describe('after deadline', () => {
        beforeEach(() => {
            process.env.EVENT_DEADLINE_ISO = new Date(Date.now() - 3600000).toISOString()
            app.use(deadlineCheck)
            app.get('/test', (_req, res) => res.json({ ok: true }))
        })

        it('returns 403 with "The event has concluded."', async () => {
            const res = await request(app).get('/test')

            expect(res.status).toBe(403)
            expect(res.body.error).toBe('The event has concluded.')
        })
    })

    describe('route exemption', () => {
        it('exempt routes (e.g. /api/quiz/status) return results even after deadline', async () => {
            process.env.EVENT_DEADLINE_ISO = new Date(Date.now() - 3600000).toISOString()

            const exemptApp = express()

            // Exempt route — no deadline middleware
            exemptApp.get('/api/quiz/status', (_req, res) =>
                res.json({ status: 'in_progress', current_sequence: 3 }),
            )

            // Protected route — deadline middleware applied
            exemptApp.use('/api/quiz/start', deadlineCheck)
            exemptApp.post('/api/quiz/start', (_req, res) => res.json({ ok: true }))

            // Status route should bypass deadline
            const statusRes = await request(exemptApp).get('/api/quiz/status')
            expect(statusRes.status).toBe(200)
            expect(statusRes.body.status).toBe('in_progress')

            // Protected route should be blocked
            const startRes = await request(exemptApp).post('/api/quiz/start')
            expect(startRes.status).toBe(403)
        })
    })

    describe('invalid deadline value', () => {
        beforeEach(() => {
            process.env.EVENT_DEADLINE_ISO = 'not-a-date'
            app.use(deadlineCheck)
            app.get('/test', (_req, res) => res.json({ ok: true }))
        })

        it('allows request through (graceful degradation)', async () => {
            const res = await request(app).get('/test')
            expect(res.status).toBe(200)
        })
    })
})
