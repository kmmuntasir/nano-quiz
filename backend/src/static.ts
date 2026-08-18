import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Express } from 'express';
import { logger } from './utils/logger.js';

// Layout assumption: backend/ and frontend/ are siblings, and the process runs
// with cwd = backend/ (e.g. /opt/nano-quiz/backend). Override with STATIC_DIR.
const DEFAULT_STATIC_DIR = path.resolve(process.cwd(), '../frontend/dist');

/**
 * Serves the built SPA (frontend/dist) when it exists. In dev the directory is
 * absent and Vite serves the frontend, so this is skipped silently.
 *
 * Order matters: registered after API routes but before the JSON 404 handler,
 * so /api/* keeps its envelope-shaped 404 while non-API GETs fall back to
 * index.html for client-side routing.
 */
export function registerStaticFrontend(app: Express): void {
  const distDir = process.env.STATIC_DIR?.trim() || DEFAULT_STATIC_DIR;

  if (!fs.existsSync(distDir)) {
    return;
  }

  const indexHtml = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    logger.warn('static dir exists but index.html is missing', { staticDir: distDir });
    return;
  }

  app.use(express.static(distDir));

  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(indexHtml, (err) => {
      if (err !== undefined) {
        next(err);
      }
    });
  });

  logger.info('serving static frontend from ' + distDir);
}
