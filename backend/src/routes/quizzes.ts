import { randomBytes } from 'node:crypto';
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

function startQuiz(req: Request, res: Response): void {
  const quiz = quizzes.getById(String(req.params.id));
  if (!quiz) {
    res
      .status(404)
      .json({ error: 'NOT_FOUND', message: 'Quiz not found.' });
    return;
  }

  // Same lexical ISO-UTC comparison as toListItem's canStart window check.
  const now = new Date().toISOString();
  const isWithinWindow = quiz.startAt <= now && quiz.endAt >= now;
  if (!isWithinWindow) {
    res
      .status(403)
      .json({ error: 'QUIZ_NOT_ACTIVE', message: 'This quiz is not currently active.' });
    return;
  }

  if (quizzes.hasParticipation(req.userId!, quiz.id)) {
    res
      .status(409)
      .json({ error: 'ALREADY_PARTICIPATED', message: 'You have already taken this quiz.' });
    return;
  }

  if (quizzes.countQuestions(quiz.id) < quiz.questionCount) {
    res
      .status(409)
      .json({ error: 'INSUFFICIENT_QUESTIONS', message: 'This quiz cannot be started due to a configuration issue.' });
    return;
  }

  res.status(200).json({
    seed: randomBytes(5).toString('hex'),
    quizId: quiz.id,
    questionCount: quiz.questionCount,
    timeLimitSeconds: quiz.timeLimitSeconds,
  });
}

export const quizzesRouter = Router();
quizzesRouter.use(requireAuth);
quizzesRouter.get('/', listQuizzes);
quizzesRouter.post('/:id/start', startQuiz);
