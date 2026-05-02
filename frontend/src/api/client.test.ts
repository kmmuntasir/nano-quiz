import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/server'
import api, { ApiError, EventConcludedError } from './client'

const BASE = 'http://localhost:3000'

describe('API client error handling', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        localStorage.clear()
    })

    it('includes auth token in requests when available', async () => {
        localStorage.setItem('token', 'test-jwt')
        server.use(
            http.get(`${BASE}/test-auth`, ({ request }) => {
                const auth = request.headers.get('Authorization')
                if (auth === 'Bearer test-jwt') {
                    return HttpResponse.json({ ok: true })
                }
                return HttpResponse.json({ error: 'No auth' }, { status: 401 })
            }),
        )

        const res = await api.get('/test-auth')
        expect(res.data.ok).toBe(true)
    })

    it('throws EventConcludedError for event-concluded 403', async () => {
        server.use(
            http.post(`${BASE}/quiz/start`, () => {
                return HttpResponse.json(
                    { error: 'The event has concluded' },
                    { status: 403 },
                )
            }),
        )

        try {
            await api.post('/quiz/start')
            expect.fail('Should have thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(EventConcludedError)
            expect((error as EventConcludedError).message).toBe('The event has concluded')
        }
    })

    it('throws EventConcludedError for "event has ended" 403', async () => {
        server.use(
            http.post(`${BASE}/quiz/start`, () => {
                return HttpResponse.json(
                    { error: 'Event has ended' },
                    { status: 403 },
                )
            }),
        )

        try {
            await api.post('/quiz/start')
            expect.fail('Should have thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(EventConcludedError)
        }
    })

    it('throws ApiError for non-event 403', async () => {
        server.use(
            http.get(`${BASE}/quiz/question/5`, () => {
                return HttpResponse.json(
                    { error: 'Cannot skip questions' },
                    { status: 403 },
                )
            }),
        )

        try {
            await api.get('/quiz/question/5')
            expect.fail('Should have thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(ApiError)
            expect(error).not.toBeInstanceOf(EventConcludedError)
            expect((error as ApiError).message).toBe('Cannot skip questions')
            expect((error as ApiError).status).toBe(403)
        }
    })

    it('throws ApiError with connection message for network errors', async () => {
        server.use(
            http.get(`${BASE}/quiz/status`, () => {
                return HttpResponse.error()
            }),
        )

        try {
            await api.get('/quiz/status')
            expect.fail('Should have thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(ApiError)
            expect((error as ApiError).message).toBe(
                'Unable to connect. Please check your internet connection.',
            )
        }
    })
})

describe('API client 401 handling', () => {
    it('clears token and user on 401', async () => {
        localStorage.setItem('token', 'expired-token')
        localStorage.setItem('user', JSON.stringify({ id: '1' }))

        server.use(
            http.get(`${BASE}/protected`, () => {
                return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }),
        )

        try {
            await api.get('/protected')
        } catch (error) {
            expect(error).toBeInstanceOf(ApiError)
            expect((error as ApiError).message).toBe('Session expired. Please log in again.')
            expect((error as ApiError).status).toBe(401)
        }

        expect(localStorage.getItem('token')).toBeNull()
        expect(localStorage.getItem('user')).toBeNull()
    })
})
