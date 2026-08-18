import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/index.js';

describe('GET /health', () => {
  it('should_return_ok_status_and_db_ok_when_called_unauthenticated', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });
});
