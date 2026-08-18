import express from 'express';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/index.js';
import { requireAuth } from '../src/middleware/auth.js';
import { users } from '../src/db/index.js';

const verifyIdTokenMock = vi.hoisted(() => vi.fn());

vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: class {
      verifyIdToken = verifyIdTokenMock;
    },
  };
});

interface TestProfile {
  sub: string;
  email: string;
  name: string;
}

function mockGooglePayload(profile: TestProfile): void {
  verifyIdTokenMock.mockResolvedValue({
    getPayload: () => ({ sub: profile.sub, email: profile.email, name: profile.name }),
  });
}

beforeEach(() => {
  verifyIdTokenMock.mockReset();
});

describe('POST /api/auth/google', () => {
  it('should_return_token_and_user_when_credentials_are_valid', async () => {
    mockGooglePayload({ sub: 'sub-1', email: 'alice@nanoquiz.app', name: 'Alice One' });

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid-token' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual({
      id: expect.any(String),
      name: 'Alice One',
      email: 'alice@nanoquiz.app',
      isAdmin: false,
    });

    const row = users.findByEmail('alice@nanoquiz.app');
    expect(row?.name).toBe('Alice One');
    expect(row?.googleSub).toBe('sub-1');
  });

  it('should_update_display_name_when_user_re_logs_in_with_new_name', async () => {
    mockGooglePayload({ sub: 'sub-2', email: 'bob@nanoquiz.app', name: 'Bob Old' });
    await request(app).post('/api/auth/google').send({ idToken: 'valid-token' });

    mockGooglePayload({ sub: 'sub-2', email: 'bob@nanoquiz.app', name: 'Bob New' });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Bob New');

    const row = users.findByEmail('bob@nanoquiz.app');
    expect(row?.name).toBe('Bob New');
  });

  it('should_return_is_admin_true_when_email_is_in_admin_emails', async () => {
    mockGooglePayload({ sub: 'sub-3', email: 'Owner@Example.com', name: 'Owner' });

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.user.isAdmin).toBe(true);
  });

  it('should_return_401_invalid_id_token_when_google_verification_fails', async () => {
    verifyIdTokenMock.mockRejectedValue(new Error('verification failed'));

    const res = await request(app).post('/api/auth/google').send({ idToken: 'bad-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_ID_TOKEN');
  });

  it('should_return_400_validation_error_when_id_token_is_missing', async () => {
    const res = await request(app).post('/api/auth/google').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_200_when_email_domain_matches_restrict_domain', async () => {
    vi.resetModules();
    vi.stubEnv('RESTRICT_DOMAIN', 'nanoquiz.app');
    const { app: restrictedApp } = await import('../src/index.js');
    mockGooglePayload({ sub: 'sub-4', email: 'carol@nanoquiz.app', name: 'Carol' });

    const res = await request(restrictedApp)
      .post('/api/auth/google')
      .send({ idToken: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('carol@nanoquiz.app');
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should_return_403_forbidden_domain_when_email_domain_does_not_match', async () => {
    vi.resetModules();
    vi.stubEnv('RESTRICT_DOMAIN', 'nanoquiz.app');
    const { app: restrictedApp } = await import('../src/index.js');
    const { users: restrictedUsers } = await import('../src/db/index.js');
    mockGooglePayload({ sub: 'sub-5', email: 'dave@example.com', name: 'Dave' });

    const res = await request(restrictedApp)
      .post('/api/auth/google')
      .send({ idToken: 'valid-token' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN_DOMAIN');
    expect(restrictedUsers.findByEmail('dave@example.com')).toBeUndefined();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe('requireAuth middleware', () => {
  const guardApp = express();
  guardApp.get(
    '/protected',
    requireAuth,
    (req: Request, res: Response): void => {
      res.status(200).json({ userId: req.userId, isAdmin: req.isAdmin });
    },
  );

  it('should_return_401_when_authorization_header_is_missing', async () => {
    const res = await request(guardApp).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_return_401_when_token_is_expired', async () => {
    const token = jwt.sign({ userId: 'u1', isAdmin: false }, 'test-jwt-secret', {
      expiresIn: '-1h',
    });

    const res = await request(guardApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_attach_identity_when_token_is_valid', async () => {
    const token = jwt.sign({ userId: 'u1', isAdmin: true }, 'test-jwt-secret', {
      expiresIn: '2h',
    });

    const res = await request(guardApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 'u1', isAdmin: true });
  });
});
