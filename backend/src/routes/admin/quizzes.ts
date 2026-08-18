import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-admin.js';

function healthz(req: Request, res: Response): void {
  void req; // probe route only — full admin CRUD arrives in later tasks
  res.status(200).json({ ok: true });
}

export const adminQuizzesRouter = Router();
adminQuizzesRouter.use(requireAuth, requireAdmin);
adminQuizzesRouter.get('/healthz', healthz);
