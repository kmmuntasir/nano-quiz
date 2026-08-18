import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

const INDEX_HTML = '<!doctype html><html><body>nanoquiz spa</body></html>';

const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoquiz-static-'));
fs.writeFileSync(path.join(staticDir, 'index.html'), INDEX_HTML);
fs.mkdirSync(path.join(staticDir, 'assets'));
fs.writeFileSync(path.join(staticDir, 'assets', 'app.js'), 'console.log("app");');

// Set before the dynamic import: the app registers static middleware at load.
process.env.STATIC_DIR = staticDir;
const { app } = await import('../src/index.js');

afterAll(() => {
  fs.rmSync(staticDir, { recursive: true, force: true });
});

describe('static frontend serving', () => {
  it('should_serve_index_html_when_get_root', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toBe(INDEX_HTML);
  });

  it('should_serve_index_html_when_get_unknown_spa_route', async () => {
    const res = await request(app).get('/quizzes/some-deep/route');

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toBe(INDEX_HTML);
  });

  it('should_serve_bundled_asset_when_get_asset_path', async () => {
    const res = await request(app).get('/assets/app.js');

    expect(res.status).toBe(200);
    expect(res.text).toBe('console.log("app");');
  });

  it('should_return_401_json_when_get_api_route_without_auth', async () => {
    const res = await request(app).get('/api/quizzes');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'UNAUTHORIZED',
      message: 'Missing Authorization header.',
    });
  });

  it('should_return_404_json_when_get_unknown_api_route', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND', message: 'Route not found.' });
  });

  it('should_return_ok_when_get_health', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });
});
