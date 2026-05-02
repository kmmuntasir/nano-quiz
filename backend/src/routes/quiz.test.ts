import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authenticatedRequest, TEST_JWT_SECRET } from '../test/helpers.js'

vi.mock('../db/index.js', () => ({
    query: vi.fn(),
    closePool: vi.fn(),
}))

import { query } from '../db/index.js'
const mockQuery = vi.mocked(query)

describe('GET /api/quiz/status', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.JWT_SECRET = TEST_JWT_SECRET
    })

    it('returns 401 without auth token', async () => {
        const { default: supertest } = await import('supertest')
        const { default: app } = await import('../index.js')

        const res = await supertest(app).get('/api/quiz/status')
        expect(res.status).toBe(401)
    })

    it('returns not started when no sessions exist', async () => {
        // Session check: no rows
        mockQuery.mockResolvedValueOnce({ rows: [] } as never)

        const res = await authenticatedRequest('get', '/api/quiz/status')

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ started: false, completed: false })
    })

    it('returns in progress with current_sequence', async () => {
        // 1. Session check: has rows
        mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
        // 2. MIN sequence: unanswered question at 3
        mockQuery.mockResolvedValueOnce({ rows: [{ current_sequence: 3 }] } as never)
        // 3. User started_at
        mockQuery.mockResolvedValueOnce({
            rows: [{ started_at: '2024-01-15T10:00:00Z' }],
        } as never)

        const res = await authenticatedRequest('get', '/api/quiz/status')

        expect(res.status).toBe(200)
        expect(res.body).toEqual({
            started: true,
            completed: false,
            current_sequence: 3,
            started_at: '2024-01-15T10:00:00Z',
        })
    })

    it('returns completed with score and timestamps', async () => {
        // 1. Session check: has rows
        mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
        // 2. MIN sequence: null (all answered)
        mockQuery.mockResolvedValueOnce({ rows: [{ current_sequence: null }] } as never)
        // 3. User data
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    score: 8,
                    started_at: '2024-01-15T10:00:00Z',
                    completed_at: '2024-01-15T10:05:32Z',
                },
            ],
        } as never)

        const res = await authenticatedRequest('get', '/api/quiz/status')

        expect(res.status).toBe(200)
        expect(res.body).toEqual({
            started: true,
            completed: true,
            score: 8,
            started_at: '2024-01-15T10:00:00Z',
            completed_at: '2024-01-15T10:05:32Z',
        })
    })

    it('recalculates score when score is null', async () => {
        // 1. Session check: has rows
        mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
        // 2. MIN sequence: null (all answered)
        mockQuery.mockResolvedValueOnce({ rows: [{ current_sequence: null }] } as never)
        // 3. User data with null score and completed_at
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    score: null,
                    started_at: '2024-01-15T10:00:00Z',
                    completed_at: null,
                },
            ],
        } as never)
        // 4. Score recalculation
        mockQuery.mockResolvedValueOnce({ rows: [{ score: 7 }] } as never)
        // 5. Update completed_at
        mockQuery.mockResolvedValueOnce({
            rows: [{ completed_at: '2024-01-15T10:06:00Z' }],
        } as never)

        const res = await authenticatedRequest('get', '/api/quiz/status')

        expect(res.status).toBe(200)
        expect(res.body.completed).toBe(true)
        expect(res.body.score).toBe(7)
        expect(res.body.completed_at).toBe('2024-01-15T10:06:00Z')
    })

    it('handles resume at first unanswered question', async () => {
        // 1. Session check: has rows
        mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
        // 2. MIN sequence: first unanswered at 1
        mockQuery.mockResolvedValueOnce({ rows: [{ current_sequence: 1 }] } as never)
        // 3. User started_at
        mockQuery.mockResolvedValueOnce({
            rows: [{ started_at: '2024-01-15T10:00:00Z' }],
        } as never)

        const res = await authenticatedRequest('get', '/api/quiz/status')

        expect(res.status).toBe(200)
        expect(res.body.current_sequence).toBe(1)
        expect(res.body.completed).toBe(false)
    })

    it('returns 500 on database error', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB connection failed') as never)

        const res = await authenticatedRequest('get', '/api/quiz/status')

        expect(res.status).toBe(500)
        expect(res.body.error).toBe('Failed to fetch quiz status')
    })
})
