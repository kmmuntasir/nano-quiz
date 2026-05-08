import { describe, it, expect, vi, beforeEach } from 'vitest'
import supertest from 'supertest'
import app from '../index.js'

vi.mock('../db/index.js', () => ({
    query: vi.fn(),
    closePool: vi.fn(),
    pool: { on: vi.fn() },
}))

import { query } from '../db/index.js'

const mockQuery = vi.mocked(query)

describe('GET /health', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 200 and healthy when DB is connected', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], command: '', rowCount: 1, oid: 0, fields: [] })

        const res = await supertest(app).get('/health')

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ status: 'healthy', database: 'connected' })
        expect(mockQuery).toHaveBeenCalledWith('SELECT 1')
    })

    it('returns 503 when DB query fails', async () => {
        mockQuery.mockRejectedValueOnce(new Error('connection refused'))

        const res = await supertest(app).get('/health')

        expect(res.status).toBe(503)
        expect(res.body).toEqual({ status: 'unhealthy' })
    })
})
