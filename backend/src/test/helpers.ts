import jwt from 'jsonwebtoken'
import supertest from 'supertest'
import app from '../index.js'

export const TEST_JWT_SECRET = 'test-jwt-secret'

interface TestJWTPayload {
    userId: string
    email: string
    name: string
}

export function generateTestToken(payload?: Partial<TestJWTPayload>): string {
    const defaults: TestJWTPayload = {
        userId: '00000000-0000-0000-0000-000000000001',
        email: 'test@example.com',
        name: 'Test User',
    }
    return jwt.sign({ ...defaults, ...payload }, TEST_JWT_SECRET, { expiresIn: '2h' })
}

export function authenticatedRequest(method: 'get' | 'post' | 'put' | 'delete', path: string, token?: string) {
    const req = supertest(app)[method](path)
    return req.set('Authorization', `Bearer ${token ?? generateTestToken()}`)
}

export { app, supertest }
