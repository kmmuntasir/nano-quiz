import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateTestToken, authenticatedRequest, supertest, TEST_JWT_SECRET } from '../test/helpers.js'
import app from '../index.js'

vi.mock('../db/index.js', () => ({
    query: vi.fn(),
    closePool: vi.fn(),
}))

vi.mock('google-auth-library', () => ({
    OAuth2Client: vi.fn().mockImplementation(() => ({
        verifyIdToken: vi.fn(),
    })),
}))

import { query } from '../db/index.js'

const mockQuery = vi.mocked(query)

describe('POST /api/auth/onboard', () => {
    const userId = '00000000-0000-0000-0000-000000000001'

    beforeEach(() => {
        vi.clearAllMocks()
        process.env.JWT_SECRET = TEST_JWT_SECRET
    })

    it('returns 401 without auth token', async () => {
        const res = await supertest(app).post('/api/auth/onboard').send({ employee_id: 'EMP123' })
        expect(res.status).toBe(401)
    })

    it('returns 400 for empty employee_id', async () => {
        const res = await authenticatedRequest('post', '/api/auth/onboard')
            .send({ employee_id: '' })
        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/required/i)
    })

    it('returns 400 for missing employee_id', async () => {
        const res = await authenticatedRequest('post', '/api/auth/onboard').send({})
        expect(res.status).toBe(400)
    })

    it('returns 400 for whitespace-only employee_id', async () => {
        const res = await authenticatedRequest('post', '/api/auth/onboard')
            .send({ employee_id: '   ' })
        expect(res.status).toBe(400)
    })

    it('returns 409 if employee_id is already taken by another user', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'other-user-id' }],
            rowCount: 1,
        } as any)

        const res = await authenticatedRequest('post', '/api/auth/onboard')
            .send({ employee_id: 'EMP123' })

        expect(res.status).toBe(409)
        expect(res.body.error).toMatch(/already taken/i)
    })

    it('returns 409 if user already has employee_id set', async () => {
        // Uniqueness check passes (no other user has it)
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        // Update returns 0 rows (user already has employee_id)
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)

        const res = await authenticatedRequest('post', '/api/auth/onboard')
            .send({ employee_id: 'EMP123' })

        expect(res.status).toBe(409)
        expect(res.body.error).toMatch(/already set/i)
    })

    it('successfully sets employee_id', async () => {
        const user = {
            id: userId,
            email: 'test@example.com',
            name: 'Test User',
            employee_id: 'EMP123',
        }

        // Uniqueness check passes
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        // Update succeeds
        mockQuery.mockResolvedValueOnce({ rows: [user], rowCount: 1 } as any)

        const res = await authenticatedRequest('post', '/api/auth/onboard')
            .send({ employee_id: 'EMP123' })

        expect(res.status).toBe(200)
        expect(res.body.message).toBe('Onboarding complete')
        expect(res.body.user.employee_id).toBe('EMP123')
    })

    it('trims whitespace from employee_id', async () => {
        const user = {
            id: userId,
            email: 'test@example.com',
            name: 'Test User',
            employee_id: 'EMP123',
        }

        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
        mockQuery.mockResolvedValueOnce({ rows: [user], rowCount: 1 } as any)

        await authenticatedRequest('post', '/api/auth/onboard')
            .send({ employee_id: '  EMP123  ' })

        // Second call is the UPDATE — check trimmed value was passed
        expect(mockQuery).toHaveBeenNthCalledWith(2,
            expect.stringContaining('UPDATE users'),
            ['EMP123', userId],
        )
    })
})
