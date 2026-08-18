import { Router } from 'express';
import type { Request, Response } from 'express';
import { quizzes } from '../db/quizzes.js';
import type { QuizListRow } from '../db/quizzes.js';
import { requireAuth } from '../middleware/auth.js';

interface QuizListItem {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  timeLimitSeconds: number;
  startAt: string;
  endAt: string;
  canStart: boolean;
  participated: boolean;
  userScore: number | null;
}

function toListItem(row: QuizListRow, now: string): QuizListItem {
  const participated = row.userScore !== null;
  const isWithinWindow = row.startAt <= now && row.endAt >= now;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    questionCount: row.questionCount,
    timeLimitSeconds: row.timeLimitSeconds,
    startAt: row.startAt,
    endAt: row.endAt,
    canStart: isWithinWindow && !participated,
    participated,
    userScore: row.userScore,
  };
}

function listQuizzes(req: Request, res: Response): void {
  // Server clock, ISO-UTC — lexically comparable with stored ISO-8601 Z timestamps.
  const now = new Date().toISOString();
  const rows = quizzes.listForUser(req.userId!, now);
  res.status(200).json(rows.map((row) => toListItem(row, now)));
}

export const quizzesRouter = Router();
quizzesRouter.use(requireAuth);
quizzesRouter.get('/', listQuizzes);
