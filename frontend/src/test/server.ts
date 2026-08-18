import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { AuthUser } from '../contexts/auth';

export const TEST_TOKEN = 'test-app-jwt';

export const TEST_USER: AuthUser = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  isAdmin: false,
};

export const handlers = [
  http.post('/api/auth/google', () => HttpResponse.json({ token: TEST_TOKEN, user: TEST_USER })),
  http.get('/api/quizzes', () => HttpResponse.json([])),
];

export const server = setupServer(...handlers);