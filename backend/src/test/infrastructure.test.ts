import { describe, it, expect, vi } from 'vitest'
import supertest from 'supertest'

vi.mock('../db/index.js', () => ({
    query: vi.fn(),
    closePool: vi.fn(),
    pool: { on: vi.fn() },
}))

import app from '../index.js'
import { query } from '../db/index.js'

const mockQuery = vi.mocked(query)

describe('Health endpoint', () => {
    it('returns healthy when DB is connected', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], command: '', rowCount: 1, oid: 0, fields: [] })

        const res = await supertest(app).get('/health')

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ status: 'healthy', database: 'connected' })
    })
})
