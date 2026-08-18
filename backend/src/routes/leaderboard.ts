import { Router } from 'express';
import type { Request, Response } from 'express';
import { quizzes } from '../db/quizzes.js';
import { requireAuth } from '../middleware/auth.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  durationMs: number;
}

interface LeaderboardResponse {
  quizId: string;
  page: number;
  pageSize: number;
  total: number;
  entries: LeaderboardEntry[];
}

function parsePagingParam(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return Number.NaN;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}

// Shared by the public route and the admin leaderboard route — one pagination
// and response-shape implementation, no duplication.
export function getLeaderboard(req: Request, res: Response): void {
  // Guard order: validation → existence.
  const page = parsePagingParam(req.query.page);
  const pageSize = parsePagingParam(req.query.pageSize);
  if (Number.isNaN(page) || Number.isNaN(pageSize)) {
    res
      .status(400)
      .json({ error: 'VALIDATION_ERROR', message: 'Page and pageSize must be positive integers.' });
    return;
  }

  const quizId = String(req.params.id);
  const quiz = quizzes.getById(quizId);
  if (!quiz) {
    res
      .status(404)
      .json({ error: 'NOT_FOUND', message: 'Quiz not found.' });
    return;
  }

  const effectivePage = page ?? DEFAULT_PAGE;
  const effectivePageSize = Math.min(pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = (effectivePage - 1) * effectivePageSize;

  const rows = quizzes.listLeaderboard(quizId, effectivePageSize, offset);
  const total = quizzes.countLeaderboard(quizId);

  const body: LeaderboardResponse = {
    quizId,
    page: effectivePage,
    pageSize: effectivePageSize,
    total,
    entries: rows.map((row, index) => ({
      rank: offset + index + 1,
      name: row.name,
      score: row.score,
      durationMs: row.durationMs,
    })),
  };
  res.status(200).json(body);
}

export const leaderboardRouter = Router();
leaderboardRouter.use(requireAuth);
leaderboardRouter.get('/:id/leaderboard', getLeaderboard);
