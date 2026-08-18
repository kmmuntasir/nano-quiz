import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { quizzes } from '../../db/quizzes.js';
import type { AdminQuestionRow, QuizInput, QuizRow } from '../../db/quizzes.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { getLeaderboard } from '../leaderboard.js';

const DEFAULT_TIME_LIMIT_SECONDS = 15;

interface QuizPayload {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  timeLimitSeconds: number;
  startAt: string;
  endAt: string;
}

function toPayload(row: QuizRow): QuizPayload {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    questionCount: row.questionCount,
    timeLimitSeconds: row.timeLimitSeconds,
    startAt: row.startAt,
    endAt: row.endAt,
  };
}

// A valid ISO-8601 UTC timestamp: round-trips through Date and back unchanged.
function isIsoUtcDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)) return false;
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString() === value;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

interface ParsedQuizInput {
  input?: QuizInput;
  message?: string;
}

// Shared field validation for create and edit. Bank-size check is separate —
// it only applies to edits (the bank is empty at create time).
function parseQuizInput(body: Record<string, unknown>): ParsedQuizInput {
  const title = body.title;
  if (typeof title !== 'string' || title.trim().length === 0) {
    return { message: 'A non-empty title is required.' };
  }

  const questionCount = body.questionCount;
  if (!isPositiveInteger(questionCount)) {
    return { message: 'questionCount must be a positive integer.' };
  }

  const rawTimeLimit = body.timeLimitSeconds ?? DEFAULT_TIME_LIMIT_SECONDS;
  if (!isPositiveInteger(rawTimeLimit)) {
    return { message: 'timeLimitSeconds must be a positive integer.' };
  }

  const startAt = body.startAt;
  const endAt = body.endAt;
  if (typeof startAt !== 'string' || !isIsoUtcDate(startAt)) {
    return { message: 'startAt must be a valid ISO-8601 UTC timestamp.' };
  }
  if (typeof endAt !== 'string' || !isIsoUtcDate(endAt)) {
    return { message: 'endAt must be a valid ISO-8601 UTC timestamp.' };
  }
  if (endAt <= startAt) {
    return { message: 'endAt must be after startAt.' };
  }

  const description = body.description;
  return {
    input: {
      title,
      description: typeof description === 'string' ? description : '',
      questionCount,
      timeLimitSeconds: rawTimeLimit,
      startAt,
      endAt,
    },
  };
}

function createQuiz(req: Request, res: Response): void {
  const parsed = parseQuizInput(req.body as Record<string, unknown>);
  if (!parsed.input) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: parsed.message });
    return;
  }

  const row = quizzes.insertQuiz(parsed.input);
  res.status(201).json(toPayload(row));
}

function listQuizzes(req: Request, res: Response): void {
  void req;
  const rows = quizzes.listAdminQuizzes();
  res.status(200).json(
    rows.map((row) => ({
      ...toPayload(row),
      questionBankSize: row.questionBankSize,
      attemptCount: row.attemptCount,
    })),
  );
}

function updateQuiz(req: Request, res: Response): void {
  const quiz = quizzes.getById(String(req.params.id));
  if (!quiz) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Quiz not found.' });
    return;
  }

  if (quizzes.countAttempts(quiz.id) > 0) {
    res
      .status(409)
      .json({ error: 'QUIZ_HAS_ATTEMPTS', message: 'Quizzes with attempts cannot be edited.' });
    return;
  }

  const parsed = parseQuizInput(req.body as Record<string, unknown>);
  if (!parsed.input) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: parsed.message });
    return;
  }

  if (parsed.input.questionCount > quizzes.countQuestions(quiz.id)) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'questionCount exceeds the question bank size.',
    });
    return;
  }

  const row = quizzes.updateQuiz(quiz.id, parsed.input);
  if (!row) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Quiz not found.' });
    return;
  }
  res.status(200).json(toPayload(row));
}

// Participations first — their FK to quizzes has no cascade; questions cascade
// via the quiz delete. One transaction so an orphaned state can never persist.
const deleteQuizWithParticipations = db.transaction((quizId: string): void => {
  quizzes.deleteParticipationsByQuiz(quizId);
  quizzes.deleteQuiz(quizId);
});

function deleteQuiz(req: Request, res: Response): void {
  const quiz = quizzes.getById(String(req.params.id));
  if (!quiz) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Quiz not found.' });
    return;
  }

  deleteQuizWithParticipations(quiz.id);
  res.status(204).send();
}

// --- Question management ---

interface AdminQuestionPayload {
  id: string;
  text: string;
  options: string[];
  correctOpt: number;
  category: string;
}

function toQuestionPayload(row: AdminQuestionRow): AdminQuestionPayload {
  return {
    id: row.id,
    text: row.prompt,
    options: JSON.parse(row.options) as string[],
    correctOpt: row.correctOpt,
    category: row.category,
  };
}

type QuestionCategory = 'faq' | 'general';

interface QuestionInput {
  text: string;
  options: string[];
  correctOpt: number;
  category: QuestionCategory;
}

interface ParsedQuestionInput {
  input?: QuestionInput;
  message?: string;
}

function parseQuestionInput(body: Record<string, unknown>): ParsedQuestionInput {
  const text = body.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { message: 'A non-empty question text is required.' };
  }

  const options = body.options;
  if (
    !Array.isArray(options) ||
    options.length < 2 ||
    !options.every((option) => typeof option === 'string' && option.trim().length > 0)
  ) {
    return { message: 'options must be an array of at least 2 non-empty strings.' };
  }

  const correctOpt = body.correctOpt;
  if (
    typeof correctOpt !== 'number' ||
    !Number.isInteger(correctOpt) ||
    correctOpt < 0 ||
    correctOpt >= options.length
  ) {
    return {
      message: 'correctOpt must be an integer between 0 and options.length - 1.',
    };
  }

  const rawCategory = body.category ?? 'general';
  if (rawCategory !== 'faq' && rawCategory !== 'general') {
    return { message: "category must be either 'faq' or 'general'." };
  }

  return { input: { text, options, correctOpt, category: rawCategory } };
}

function listQuestionsHandler(req: Request, res: Response): void {
  const quiz = quizzes.getById(String(req.params.id));
  if (!quiz) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Quiz not found.' });
    return;
  }

  res.status(200).json(quizzes.listQuestions(quiz.id).map(toQuestionPayload));
}

function createQuestion(req: Request, res: Response): void {
  const quiz = quizzes.getById(String(req.params.id));
  if (!quiz) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Quiz not found.' });
    return;
  }

  const parsed = parseQuestionInput(req.body as Record<string, unknown>);
  if (!parsed.input) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: parsed.message });
    return;
  }

  const seq = (quizzes.maxQuestionSeq(quiz.id) ?? 0) + 1;
  const row = quizzes.insertQuestion(
    quiz.id,
    randomUUID(),
    seq,
    parsed.input.text,
    JSON.stringify(parsed.input.options),
    parsed.input.correctOpt,
    parsed.input.category,
  );
  res.status(201).json(toQuestionPayload(row));
}

function updateQuestion(req: Request, res: Response): void {
  const quiz = quizzes.getById(String(req.params.id));
  if (!quiz) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Quiz not found.' });
    return;
  }

  const question = quizzes.findQuestionById(quiz.id, String(req.params.questionId));
  if (!question) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Question not found.' });
    return;
  }

  if (quizzes.countAttempts(quiz.id) > 0) {
    res
      .status(409)
      .json({ error: 'QUIZ_HAS_ATTEMPTS', message: 'Quizzes with attempts cannot be edited.' });
    return;
  }

  const parsed = parseQuestionInput(req.body as Record<string, unknown>);
  if (!parsed.input) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: parsed.message });
    return;
  }

  const row = quizzes.updateQuestion(
    question.id,
    parsed.input.text,
    JSON.stringify(parsed.input.options),
    parsed.input.correctOpt,
    parsed.input.category,
  );
  if (!row) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Question not found.' });
    return;
  }
  res.status(200).json(toQuestionPayload(row));
}

function deleteQuestion(req: Request, res: Response): void {
  const quiz = quizzes.getById(String(req.params.id));
  if (!quiz) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Quiz not found.' });
    return;
  }

  const question = quizzes.findQuestionById(quiz.id, String(req.params.questionId));
  if (!question) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Question not found.' });
    return;
  }

  if (quizzes.countAttempts(quiz.id) > 0) {
    res
      .status(409)
      .json({ error: 'QUIZ_HAS_ATTEMPTS', message: 'Quizzes with attempts cannot be edited.' });
    return;
  }

  quizzes.deleteQuestion(question.id);
  res.status(204).send();
}

export const adminQuizzesRouter = Router();
adminQuizzesRouter.use(requireAuth, requireAdmin);
adminQuizzesRouter.post('/', createQuiz);
adminQuizzesRouter.get('/', listQuizzes);
adminQuizzesRouter.put('/:id', updateQuiz);
adminQuizzesRouter.delete('/:id', deleteQuiz);
adminQuizzesRouter.get('/:id/questions', listQuestionsHandler);
adminQuizzesRouter.post('/:id/questions', createQuestion);
adminQuizzesRouter.put('/:id/questions/:questionId', updateQuestion);
adminQuizzesRouter.delete('/:id/questions/:questionId', deleteQuestion);
adminQuizzesRouter.get('/:id/leaderboard', getLeaderboard);
