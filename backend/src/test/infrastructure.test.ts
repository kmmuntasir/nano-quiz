import { describe, it, expect } from 'vitest'
import supertest from 'supertest'
import app from '../index.js'

describe('Health endpoint', () => {
    it('returns ok status', async () => {
        const res = await supertest(app).get('/health')
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ status: 'ok' })
    })
})
