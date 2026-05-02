import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { generateTestToken, authenticatedRequest, supertest, TEST_JWT_SECRET } from '../test/helpers.js'
import app from '../index.js'

const { mockVerifyIdToken } = vi.hoisted(() => ({
    mockVerifyIdToken: vi.fn(),
}))

vi.mock('../db/index.js', () => ({
    query: vi.fn(),
    closePool: vi.fn(),
}))

vi.mock('google-auth-library', () => ({
    OAuth2Client: vi.fn().mockImplementation(() => ({
        verifyIdToken: mockVerifyIdToken,
    })),
}))

import { query } from '../db/index.js'

const mockQuery = vi.mocked(query)

describe('POST /api/auth/google', () => {
    const googlePayload = {
        sub: 'google-123',
        email: 'user@example.com',
        name: 'Test User',
    }

    beforeEach(() => {
        vi.clearAllMocks()
        process.env.JWT_SECRET = TEST_JWT_SECRET
        process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    })

    afterEach(() => {
        delete process.env.RESTRICT_DOMAIN
    })

    it('creates new user and returns JWT + onboarding_required: true', async () => {
        mockVerifyIdToken.mockResolvedValue({
            getPayload: () => ({ ...googlePayload }),
        })

        const newUser = {
            id: '00000000-0000-0000-0000-000000000099',
            email: 'user@example.com',
            name: 'Test User',
            employee_id: null,
        }
        mockQuery.mockResolvedValueOnce({ rows: [newUser], rowCount: 1 } as any)

        const res = await supertest(app)
            .post('/api/auth/google')
            .send({ token: 'valid-google-token' })

        expect(res.status).toBe(200)
        expect(res.body.token).toBeDefined()
        expect(res.body.user).toEqual({
            id: newUser.id,
            email: 'user@example.com',
            name: 'Test User',
            employee_id: null,
        })
        expect(res.body.onboarding_required).toBe(true)

        const decoded = jwt.verify(res.body.token, TEST_JWT_SECRET) as any
        expect(decoded.userId).toBe(newUser.id)
    })

    it('returns JWT + onboarding_required: false for existing user with employee_id', async () => {
        mockVerifyIdToken.mockResolvedValue({
            getPayload: () => ({ ...googlePayload }),
        })

        const existingUser = {
            id: '00000000-0000-0000-0000-000000000099',
            email: 'user@example.com',
            name: 'Test User',
            employee_id: 'EMP001',
        }
        mockQuery.mockResolvedValueOnce({ rows: [existingUser], rowCount: 1 } as any)

        const res = await supertest(app)
            .post('/api/auth/google')
            .send({ token: 'valid-google-token' })

        expect(res.status).toBe(200)
        expect(res.body.onboarding_required).toBe(false)
        expect(res.body.user.employee_id).toBe('EMP001')
    })

    it('rejects when RESTRICT_DOMAIN is set and email domain does not match', async () => {
        process.env.RESTRICT_DOMAIN = 'company.com'

        mockVerifyIdToken.mockResolvedValue({
            getPayload: () => ({
                ...googlePayload,
                email: 'user@other.com',
            }),
        })

        const res = await supertest(app)
            .post('/api/auth/google')
            .send({ token: 'valid-google-token' })

        expect(res.status).toBe(403)
        expect(res.body.error).toMatch(/company\.com/)
    })

    it('returns 401 when Google token verification throws', async () => {
        mockVerifyIdToken.mockRejectedValue(new Error('Token verification failed'))

        const res = await supertest(app)
            .post('/api/auth/google')
            .send({ token: 'bad-token' })

        expect(res.status).toBe(401)
        expect(res.body.error).toMatch(/invalid/i)
    })

    it('returns 401 when payload is incomplete', async () => {
        mockVerifyIdToken.mockResolvedValue({
            getPayload: () => ({ sub: 'google-123' }),
        })

        const res = await supertest(app)
            .post('/api/auth/google')
            .send({ token: 'incomplete-token' })

        expect(res.status).toBe(401)
    })

    it('issues JWT with 2-hour expiry', async () => {
        mockVerifyIdToken.mockResolvedValue({
            getPayload: () => ({ ...googlePayload }),
        })

        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'user-1', email: 'user@example.com', name: 'Test User', employee_id: null }],
            rowCount: 1,
        } as any)

        const res = await supertest(app)
            .post('/api/auth/google')
            .send({ token: 'valid-google-token' })

        const decoded = jwt.verify(res.body.token, TEST_JWT_SECRET) as any
        expect(decoded.exp - decoded.iat).toBe(7200)
    })

    it('returns 400 when token is missing', async () => {
        const res = await supertest(app)
            .post('/api/auth/google')
            .send({})

        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/required/i)
    })

    it('allows request when RESTRICT_DOMAIN matches email domain', async () => {
        process.env.RESTRICT_DOMAIN = 'example.com'

        mockVerifyIdToken.mockResolvedValue({
            getPayload: () => ({ ...googlePayload }),
        })

        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'user-1', email: 'user@example.com', name: 'Test User', employee_id: null }],
            rowCount: 1,
        } as any)

        const res = await supertest(app)
            .post('/api/auth/google')
            .send({ token: 'valid-google-token' })

        expect(res.status).toBe(200)
    })
})

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
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
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

        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
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

        expect(mockQuery).toHaveBeenNthCalledWith(2,
            expect.stringContaining('UPDATE users'),
            ['EMP123', userId],
        )
    })
})
