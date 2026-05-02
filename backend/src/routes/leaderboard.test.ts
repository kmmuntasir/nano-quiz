import { describe, it, expect, beforeEach, vi } from 'vitest'
import express, { Express } from 'express'
import request from 'supertest'

vi.mock('../db/index.js', () => ({
    query: vi.fn(),
}))

import { query } from '../db/index.js'
import leaderboardRouter from './leaderboard.js'

const mockedQuery = vi.mocked(query)

describe('GET /api/leaderboard', () => {
    let app: Express

    beforeEach(() => {
        vi.clearAllMocks()
        app = express()
        app.use(leaderboardRouter)
    })

    it('returns empty array when no users completed', async () => {
        mockedQuery.mockResolvedValueOnce({ rows: [] } as any)

        const res = await request(app).get('/api/leaderboard')

        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })

    it('returns users sorted by score DESC', async () => {
        mockedQuery.mockResolvedValueOnce({
            rows: [
                { rank: 1, name: 'Alice', employee_id: 'E1', score: 10, duration_seconds: 300 },
                { rank: 2, name: 'Bob', employee_id: 'E2', score: 8, duration_seconds: 200 },
                { rank: 3, name: 'Charlie', employee_id: 'E3', score: 5, duration_seconds: 150 },
            ],
        } as any)

        const res = await request(app).get('/api/leaderboard')

        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(3)
        expect(res.body[0].score).toBe(10)
        expect(res.body[1].score).toBe(8)
        expect(res.body[2].score).toBe(5)
    })

    it('breaks ties by duration ASC', async () => {
        mockedQuery.mockResolvedValueOnce({
            rows: [
                { rank: 1, name: 'Fast', employee_id: 'E1', score: 10, duration_seconds: 200 },
                { rank: 2, name: 'Medium', employee_id: 'E2', score: 10, duration_seconds: 300 },
                { rank: 3, name: 'Slow', employee_id: 'E3', score: 10, duration_seconds: 400 },
            ],
        } as any)

        const res = await request(app).get('/api/leaderboard')

        expect(res.status).toBe(200)
        expect(res.body[0].name).toBe('Fast')
        expect(res.body[0].duration_seconds).toBe(200)
        expect(res.body[1].name).toBe('Medium')
        expect(res.body[2].name).toBe('Slow')
    })

    it('excludes users who have not completed the quiz', async () => {
        mockedQuery.mockResolvedValueOnce({
            rows: [{ rank: 1, name: 'Alice', employee_id: 'E1', score: 10, duration_seconds: 200 }],
        } as any)

        await request(app).get('/api/leaderboard')

        const sql = mockedQuery.mock.calls[0][0] as string
        expect(sql).toContain('completed_at IS NOT NULL')
    })

    it('includes rank field starting at 1', async () => {
        mockedQuery.mockResolvedValueOnce({
            rows: [
                { rank: 1, name: 'Alice', employee_id: 'E1', score: 10, duration_seconds: 200 },
                { rank: 2, name: 'Bob', employee_id: 'E2', score: 8, duration_seconds: 300 },
            ],
        } as any)

        const res = await request(app).get('/api/leaderboard')

        expect(res.body[0].rank).toBe(1)
        expect(res.body[1].rank).toBe(2)

        const sql = mockedQuery.mock.calls[0][0] as string
        expect(sql).toContain('ROW_NUMBER()')
    })

    it('returns 500 when database fails', async () => {
        mockedQuery.mockRejectedValueOnce(new Error('DB connection lost'))

        const res = await request(app).get('/api/leaderboard')

        expect(res.status).toBe(500)
        expect(res.body.error).toBe('Failed to fetch leaderboard')
    })
})
