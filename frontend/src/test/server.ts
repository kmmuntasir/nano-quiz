import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:3000'

export const handlers = [
    http.post(`${BASE}/api/auth/google`, async () => {
        return HttpResponse.json({
            token: 'test-jwt-token',
            user: {
                id: 'test-user-id',
                email: 'test@example.com',
                name: 'Test User',
                picture: '',
            },
        })
    }),

    http.post(`${BASE}/api/auth/onboard`, async () => {
        return HttpResponse.json({
            user: {
                id: 'test-user-id',
                email: 'test@example.com',
                name: 'Test User',
                employee_id: 'EMP001',
            },
        })
    }),

    http.get(`${BASE}/api/quiz/status`, () => {
        return HttpResponse.json({
            status: 'not_started',
            current_sequence: null,
        })
    }),

    http.post(`${BASE}/api/quiz/start`, () => {
        return HttpResponse.json({
            message: 'Quiz started',
            total_questions: 10,
        })
    }),

    http.get(`${BASE}/api/quiz/question/:sequence`, ({ params }) => {
        return HttpResponse.json({
            sequence: Number(params.sequence),
            question: 'Sample question text?',
            opt_a: 'Option A',
            opt_b: 'Option B',
            opt_c: 'Option C',
            opt_d: 'Option D',
        })
    }),

    http.post(`${BASE}/api/quiz/answer`, () => {
        return HttpResponse.json({ message: 'Answer recorded' })
    }),

    http.get(`${BASE}/api/leaderboard`, () => {
        return HttpResponse.json({
            leaderboard: [
                { rank: 1, name: 'User One', employee_id: 'EMP001', score: 10, duration_seconds: 120 },
                { rank: 2, name: 'User Two', employee_id: 'EMP002', score: 9, duration_seconds: 150 },
            ],
        })
    }),
]

export const server = setupServer(...handlers)
