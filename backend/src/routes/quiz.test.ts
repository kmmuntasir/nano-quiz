import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authenticatedRequest, TEST_JWT_SECRET } from '../test/helpers.js'

const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
}

vi.mock('../db/index.js', () => ({
    query: vi.fn(),
    getClient: vi.fn(() => Promise.resolve(mockClient)),
    closePool: vi.fn(),
}))

import { query } from '../db/index.js'
const mockQuery = vi.mocked(query)

const mockQueryOnce = (rows: unknown[]) =>
    mockQuery.mockResolvedValueOnce({ rows } as never)

const mockRejectOnce = (err: Error) =>
    mockQuery.mockRejectedValueOnce(err as never)

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
        mockQueryOnce([])

        const res = await authenticatedRequest('get', '/api/quiz/status')

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ started: false, completed: false })
    })

    it('returns in progress with current_sequence', async () => {
        mockQueryOnce([{ '?column?': 1 }])
        mockQueryOnce([{ current_sequence: 3 }])
        mockQueryOnce([{ started_at: '2024-01-15T10:00:00Z' }])

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
        mockQueryOnce([{ '?column?': 1 }])
        mockQueryOnce([{ current_sequence: null }])
        mockQueryOnce([{
            score: 8,
            started_at: '2024-01-15T10:00:00Z',
            completed_at: '2024-01-15T10:05:32Z',
        }])

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
        mockQueryOnce([{ '?column?': 1 }])
        mockQueryOnce([{ current_sequence: null }])
        mockQueryOnce([{
            score: null,
            started_at: '2024-01-15T10:00:00Z',
            completed_at: null,
        }])
        mockQueryOnce([{ score: 7 }])
        mockQueryOnce([{ completed_at: '2024-01-15T10:06:00Z' }])

        const res = await authenticatedRequest('get', '/api/quiz/status')

        expect(res.status).toBe(200)
        expect(res.body.completed).toBe(true)
        expect(res.body.score).toBe(7)
        expect(res.body.completed_at).toBe('2024-01-15T10:06:00Z')
    })

    it('handles resume at first unanswered question', async () => {
        mockQueryOnce([{ '?column?': 1 }])
        mockQueryOnce([{ current_sequence: 1 }])
        mockQueryOnce([{ started_at: '2024-01-15T10:00:00Z' }])

        const res = await authenticatedRequest('get', '/api/quiz/status')

        expect(res.status).toBe(200)
        expect(res.body.current_sequence).toBe(1)
        expect(res.body.completed).toBe(false)
    })

    it('returns 500 on database error', async () => {
        mockRejectOnce(new Error('DB connection failed'))

        const res = await authenticatedRequest('get', '/api/quiz/status')

        expect(res.status).toBe(500)
        expect(res.body.error).toBe('Failed to fetch quiz status')
    })
})

describe('POST /api/quiz/start', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockClient.query.mockReset()
        mockClient.release.mockReset()
        process.env.JWT_SECRET = TEST_JWT_SECRET
    })

    it('returns 401 without auth token', async () => {
        const { default: supertest } = await import('supertest')
        const { default: app } = await import('../index.js')

        const res = await supertest(app).post('/api/quiz/start')
        expect(res.status).toBe(401)
    })

    it('creates 10 session rows on success', async () => {
        mockQueryOnce([{ employee_id: 'EMP001', started_at: null }])
        mockQueryOnce([
            { category: 'faq', count: '8' },
            { category: 'trivia', count: '8' },
        ])
        mockClient.query
            .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
            .mockResolvedValueOnce({
                rows: [{ started_at: '2024-01-15T10:00:00Z' }],
                rowCount: 1,
            } as never)
            .mockResolvedValueOnce({ rows: [] } as never) // INSERT
            .mockResolvedValueOnce({ rows: [] } as never) // COMMIT

        const res = await authenticatedRequest('post', '/api/quiz/start')

        expect(res.status).toBe(200)
        expect(res.body.message).toBe('Quiz started')
        expect(res.body.total_questions).toBe(10)
        expect(res.body.started_at).toBe('2024-01-15T10:00:00Z')
    })

    it('returns existing session if already started (idempotent)', async () => {
        mockQueryOnce([{ employee_id: 'EMP001', started_at: '2024-01-15T10:00:00Z' }])
        mockQueryOnce([
            { sequence_order: 1, question_id: 'q1' },
            { sequence_order: 2, question_id: 'q2' },
        ])

        const res = await authenticatedRequest('post', '/api/quiz/start')

        expect(res.status).toBe(200)
        expect(res.body.message).toBe('Quiz already started')
        expect(res.body.started_at).toBe('2024-01-15T10:00:00Z')
        expect(res.body.total_questions).toBe(2)
    })

    it('returns 403 when not onboarded', async () => {
        mockQueryOnce([{ employee_id: null, started_at: null }])

        const res = await authenticatedRequest('post', '/api/quiz/start')

        expect(res.status).toBe(403)
        expect(res.body.error).toBe('Onboarding required before starting quiz')
    })

    it('returns 404 when user not found', async () => {
        mockQueryOnce([])

        const res = await authenticatedRequest('post', '/api/quiz/start')

        expect(res.status).toBe(404)
        expect(res.body.error).toBe('User not found')
    })

    it('returns 503 when insufficient questions in DB', async () => {
        mockQueryOnce([{ employee_id: 'EMP001', started_at: null }])
        mockQueryOnce([
            { category: 'faq', count: '3' },
            { category: 'trivia', count: '4' },
        ])

        const res = await authenticatedRequest('post', '/api/quiz/start')

        expect(res.status).toBe(503)
        expect(res.body.error).toBe('Insufficient questions available')
        expect(res.body.detail).toEqual({
            faq_required: 6,
            faq_available: 3,
            trivia_required: 4,
            trivia_available: 4,
        })
    })

    it('returns 503 when no questions in DB at all', async () => {
        mockQueryOnce([{ employee_id: 'EMP001', started_at: null }])
        mockQueryOnce([])

        const res = await authenticatedRequest('post', '/api/quiz/start')

        expect(res.status).toBe(503)
        expect(res.body.detail.faq_available).toBe(0)
        expect(res.body.detail.trivia_available).toBe(0)
    })

    it('returns 500 on database error', async () => {
        mockRejectOnce(new Error('DB down'))

        const res = await authenticatedRequest('post', '/api/quiz/start')

        expect(res.status).toBe(500)
        expect(res.body.error).toBe('Failed to start quiz')
    })
})

describe('GET /api/quiz/question/:sequence', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.JWT_SECRET = TEST_JWT_SECRET
    })

    it('returns 401 without auth token', async () => {
        const { default: supertest } = await import('supertest')
        const { default: app } = await import('../index.js')

        const res = await supertest(app).get('/api/quiz/question/1')
        expect(res.status).toBe(401)
    })

    it('returns question without correct_opt on success', async () => {
        mockQueryOnce([{ current_seq: 1 }])
        mockQueryOnce([{
            sequence_order: 1,
            question_text: 'What year was the company founded?',
            opt_a: '2018',
            opt_b: '2019',
            opt_c: '2020',
            opt_d: '2021',
        }])

        const res = await authenticatedRequest('get', '/api/quiz/question/1')

        expect(res.status).toBe(200)
        expect(res.body).toEqual({
            sequence_order: 1,
            question: 'What year was the company founded?',
            options: {
                A: '2018',
                B: '2019',
                C: '2020',
                D: '2021',
            },
        })
        expect(res.body).not.toHaveProperty('correct_opt')
    })

    it('returns 403 when backtracking to answered sequence', async () => {
        mockQueryOnce([{ current_seq: 5 }])

        const res = await authenticatedRequest('get', '/api/quiz/question/3')

        expect(res.status).toBe(403)
        expect(res.body.error).toContain('Must answer question 5 first')
    })

    it('returns 403 when forward-jumping to unanswered sequence', async () => {
        mockQueryOnce([{ current_seq: 2 }])

        const res = await authenticatedRequest('get', '/api/quiz/question/5')

        expect(res.status).toBe(403)
        expect(res.body.error).toContain('Must answer question 2 first')
    })

    it('returns 403 when quiz already completed', async () => {
        mockQueryOnce([{ current_seq: null }])

        const res = await authenticatedRequest('get', '/api/quiz/question/5')

        expect(res.status).toBe(403)
        expect(res.body.error).toBe('Quiz already completed')
    })

    it('returns 404 for out-of-range sequence (0)', async () => {
        const res = await authenticatedRequest('get', '/api/quiz/question/0')

        expect(res.status).toBe(404)
        expect(res.body.error).toContain('Invalid sequence number')
    })

    it('returns 404 for out-of-range sequence (11)', async () => {
        const res = await authenticatedRequest('get', '/api/quiz/question/11')

        expect(res.status).toBe(404)
        expect(res.body.error).toContain('Invalid sequence number')
    })

    it('returns 404 for non-integer sequence', async () => {
        const res = await authenticatedRequest('get', '/api/quiz/question/abc')

        expect(res.status).toBe(404)
    })

    it('returns 404 when question row not found', async () => {
        mockQueryOnce([{ current_seq: 1 }])
        mockQueryOnce([])

        const res = await authenticatedRequest('get', '/api/quiz/question/1')

        expect(res.status).toBe(404)
        expect(res.body.error).toBe('Question not found')
    })

    it('returns 500 on database error', async () => {
        mockRejectOnce(new Error('DB error'))

        const res = await authenticatedRequest('get', '/api/quiz/question/1')

        expect(res.status).toBe(500)
        expect(res.body.error).toBe('Failed to fetch question')
    })
})

describe('POST /api/quiz/answer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockClient.query.mockReset()
        mockClient.release.mockReset()
        process.env.JWT_SECRET = TEST_JWT_SECRET
    })

    it('returns 401 without auth token', async () => {
        const { default: supertest } = await import('supertest')
        const { default: app } = await import('../index.js')

        const res = await supertest(app)
            .post('/api/quiz/answer')
            .send({ sequence_order: 1, answer: 'A' })
        expect(res.status).toBe(401)
    })

    it('saves answer and returns success', async () => {
        mockQueryOnce([{ user_answer: null }])
        mockQueryOnce([])
        mockQueryOnce({ rows: [] } as never)

        const res = await authenticatedRequest('post', '/api/quiz/answer')
            .send({ sequence_order: 1, answer: 'A' })

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ success: true })
    })

    it('returns 409 for duplicate answer on same sequence', async () => {
        mockQueryOnce([{ user_answer: 'B' }])

        const res = await authenticatedRequest('post', '/api/quiz/answer')
            .send({ sequence_order: 1, answer: 'A' })

        expect(res.status).toBe(409)
        expect(res.body.error).toBe('Answer already submitted for this question')
    })

    it('returns 409 when prior sequence unanswered', async () => {
        mockQueryOnce([{ user_answer: null }])
        mockQueryOnce([{ sequence_order: 2 }])

        const res = await authenticatedRequest('post', '/api/quiz/answer')
            .send({ sequence_order: 5, answer: 'A' })

        expect(res.status).toBe(409)
        expect(res.body.error).toContain('Must answer question 2 first')
    })

    it('returns 404 when session row not found', async () => {
        mockQueryOnce([])

        const res = await authenticatedRequest('post', '/api/quiz/answer')
            .send({ sequence_order: 1, answer: 'A' })

        expect(res.status).toBe(404)
        expect(res.body.error).toBe('Question not found for this sequence')
    })

    it('returns 400 for invalid sequence_order', async () => {
        const res = await authenticatedRequest('post', '/api/quiz/answer')
            .send({ sequence_order: 0, answer: 'A' })

        expect(res.status).toBe(400)
        expect(res.body.error).toContain('Invalid sequence_order')
    })

    it('returns 400 for invalid answer option', async () => {
        const res = await authenticatedRequest('post', '/api/quiz/answer')
            .send({ sequence_order: 1, answer: 'X' })

        expect(res.status).toBe(400)
        expect(res.body.error).toContain('Invalid answer')
    })

    it('returns 400 for missing answer', async () => {
        const res = await authenticatedRequest('post', '/api/quiz/answer')
            .send({ sequence_order: 1 })

        expect(res.status).toBe(400)
    })

    it('finalizes quiz on Q10: sets completed_at, calculates score', async () => {
        mockQueryOnce([{ user_answer: null }])
        mockQueryOnce([])
        mockQueryOnce({ rows: [] } as never) // UPDATE answer

        mockClient.query
            .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
            .mockResolvedValueOnce({ rows: [{ score: 8 }] } as never) // Score calc
            .mockResolvedValueOnce({
                rows: [{ completed_at: '2024-01-15T10:12:00Z', duration_seconds: 720 }],
            } as never)
            .mockResolvedValueOnce({ rows: [] } as never) // COMMIT

        const res = await authenticatedRequest('post', '/api/quiz/answer')
            .send({ sequence_order: 10, answer: 'C' })

        expect(res.status).toBe(200)
        expect(res.body).toEqual({
            success: true,
            completed: true,
            score: 8,
            completed_at: '2024-01-15T10:12:00Z',
            duration_seconds: 720,
        })
    })

    it('returns 500 on database error', async () => {
        mockRejectOnce(new Error('DB error'))

        const res = await authenticatedRequest('post', '/api/quiz/answer')
            .send({ sequence_order: 1, answer: 'A' })

        expect(res.status).toBe(500)
        expect(res.body.error).toBe('Failed to submit answer')
    })
})

describe('Full Quiz Lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockClient.query.mockReset()
        mockClient.release.mockReset()
        process.env.JWT_SECRET = TEST_JWT_SECRET
    })

    it('completes full flow: start → Q1..Q10 → score', async () => {
        // POST /start
        mockQueryOnce([{ employee_id: 'EMP001', started_at: null }])
        mockQueryOnce([
            { category: 'faq', count: '8' },
            { category: 'trivia', count: '8' },
        ])
        mockClient.query
            .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
            .mockResolvedValueOnce({
                rows: [{ started_at: '2024-01-15T10:00:00Z' }],
                rowCount: 1,
            } as never)
            .mockResolvedValueOnce({ rows: [] } as never) // INSERT sessions
            .mockResolvedValueOnce({ rows: [] } as never) // COMMIT

        const startRes = await authenticatedRequest('post', '/api/quiz/start')
        expect(startRes.status).toBe(200)
        expect(startRes.body.total_questions).toBe(10)

        // Answer Q1-Q9
        for (let seq = 1; seq <= 9; seq++) {
            // GET /question/:seq
            mockQueryOnce([{ current_seq: seq }])
            mockQueryOnce([{
                sequence_order: seq,
                question_text: `Question ${seq}?`,
                opt_a: 'A1',
                opt_b: 'B1',
                opt_c: 'C1',
                opt_d: 'D1',
            }])

            const qRes = await authenticatedRequest('get', `/api/quiz/question/${seq}`)
            expect(qRes.status).toBe(200)
            expect(qRes.body.sequence_order).toBe(seq)
            expect(qRes.body).not.toHaveProperty('correct_opt')

            // POST /answer
            mockQueryOnce([{ user_answer: null }])
            mockQueryOnce([]) // No unanswered priors
            mockQueryOnce({ rows: [] } as never) // UPDATE

            const aRes = await authenticatedRequest('post', '/api/quiz/answer')
                .send({ sequence_order: seq, answer: 'A' })
            expect(aRes.status).toBe(200)
            expect(aRes.body.success).toBe(true)
            if (seq < 10) {
                expect(aRes.body.completed).toBeUndefined()
            }
        }

        // GET /question/10
        mockQueryOnce([{ current_seq: 10 }])
        mockQueryOnce([{
            sequence_order: 10,
            question_text: 'Final question?',
            opt_a: 'A10',
            opt_b: 'B10',
            opt_c: 'C10',
            opt_d: 'D10',
        }])

        const q10Res = await authenticatedRequest('get', '/api/quiz/question/10')
        expect(q10Res.status).toBe(200)
        expect(q10Res.body.sequence_order).toBe(10)

        // POST /answer Q10 → completes quiz
        mockQueryOnce([{ user_answer: null }])
        mockQueryOnce([]) // No unanswered priors
        mockQueryOnce({ rows: [] } as never) // UPDATE answer

        mockClient.query
            .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
            .mockResolvedValueOnce({ rows: [{ score: 7 }] } as never) // Score
            .mockResolvedValueOnce({
                rows: [{ completed_at: '2024-01-15T10:10:00Z', duration_seconds: 600 }],
            } as never)
            .mockResolvedValueOnce({ rows: [] } as never) // COMMIT

        const finalRes = await authenticatedRequest('post', '/api/quiz/answer')
            .send({ sequence_order: 10, answer: 'B' })

        expect(finalRes.status).toBe(200)
        expect(finalRes.body.completed).toBe(true)
        expect(finalRes.body.score).toBe(7)
        expect(finalRes.body.completed_at).toBe('2024-01-15T10:10:00Z')
        expect(finalRes.body.duration_seconds).toBe(600)
    })

    it('blocks backtracking mid-lifecycle', async () => {
        // Current question is 5, trying to access 3
        mockQueryOnce([{ current_seq: 5 }])

        const res = await authenticatedRequest('get', '/api/quiz/question/3')

        expect(res.status).toBe(403)
        expect(res.body.error).toContain('Must answer question 5 first')
    })

    it('blocks forward-jumping mid-lifecycle', async () => {
        // Current question is 3, trying to access 7
        mockQueryOnce([{ current_seq: 3 }])

        const res = await authenticatedRequest('get', '/api/quiz/question/7')

        expect(res.status).toBe(403)
        expect(res.body.error).toContain('Must answer question 3 first')
    })

    it('idempotent start returns existing session', async () => {
        mockQueryOnce([{ employee_id: 'EMP001', started_at: '2024-01-15T10:00:00Z' }])
        mockQueryOnce(
            Array.from({ length: 10 }, (_, i) => ({
                sequence_order: i + 1,
                question_id: `q-${i + 1}`,
            })),
        )

        const res = await authenticatedRequest('post', '/api/quiz/start')

        expect(res.status).toBe(200)
        expect(res.body.message).toBe('Quiz already started')
        expect(res.body.total_questions).toBe(10)
        expect(res.body.started_at).toBe('2024-01-15T10:00:00Z')
    })
})
