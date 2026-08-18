import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db/index.js';

const healthRouter = Router();

const pingStmt = db.prepare<[], { ok: number }>('SELECT 1 AS ok');

// Unauthenticated per API.md:255-257 — live DB connectivity check.
healthRouter.get('/', (_req: Request, res: Response): void => {
  pingStmt.get();
  res.status(200).json({ status: 'ok', db: 'ok' });
});

export { healthRouter };
