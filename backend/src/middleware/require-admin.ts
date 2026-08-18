import type { NextFunction, Request, Response } from 'express';

const FORBIDDEN_ERROR = 'FORBIDDEN';

// Runs after requireAuth — 401 for bad tokens is requireAuth's job.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.isAdmin !== true) {
    res.status(403).json({ error: FORBIDDEN_ERROR, message: 'Admin access required.' });
    return;
  }
  next();
}
