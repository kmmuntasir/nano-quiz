import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/index.js';

const JWT_SECRET = 'test-jwt-secret';

function signToken(isAdmin: boolean): string {
  return jwt.sign({ userId: 'u1', isAdmin }, JWT_SECRET, { expiresIn: '2h' });
}

describe('GET /api/admin/quizzes/healthz', () => {
  it('should_return_401_when_authorization_header_is_missing', async () => {
    const res = await request(app).get('/api/admin/quizzes/healthz');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_return_401_when_token_is_malformed', async () => {
    const res = await request(app)
      .get('/api/admin/quizzes/healthz')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_return_403_forbidden_when_token_has_is_admin_false', async () => {
    const res = await request(app)
      .get('/api/admin/quizzes/healthz')
      .set('Authorization', `Bearer ${signToken(false)}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN', message: 'Admin access required.' });
  });

  it('should_return_200_ok_when_token_has_is_admin_true', async () => {
    const res = await request(app)
      .get('/api/admin/quizzes/healthz')
      .set('Authorization', `Bearer ${signToken(true)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
