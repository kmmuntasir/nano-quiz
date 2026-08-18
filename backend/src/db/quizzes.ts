import { randomUUID } from 'node:crypto';

import { db } from './index.js';

export interface QuizListRow {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  timeLimitSeconds: number;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
  /** Score from the caller's participation row; NULL when never taken. */
  userScore: number | null;
  /** Size of the quiz's question bank — drives admin preview canStart. */
  questionBankSize: number;
}

// Single statement — no N+1. Locked ordering via derived rank:
// Live (0) → Upcoming (1) → Ended (2); within Live soonest end first,
// within Upcoming soonest start first, within Ended most recently ended first.
// `now` is bound once (server clock, ISO-UTC) and is lexically comparable
// with the ISO-8601 `Z` timestamps stored in the schema.
interface QuizListParams {
  userId: string;
  now: string;
}

const selectQuizzesForUserStmt = db.prepare<QuizListParams, QuizListRow>(
  `SELECT
     q.id,
     q.title,
     q.description,
     q.question_count AS questionCount,
     q.time_limit_seconds AS timeLimitSeconds,
     q.start_at AS startAt,
     q.end_at AS endAt,
     q.created_at AS createdAt,
     q.updated_at AS updatedAt,
     p.score AS userScore,
     (SELECT COUNT(*) FROM questions qs WHERE qs.quiz_id = q.id) AS questionBankSize
   FROM quizzes q
   LEFT JOIN participations p
     ON p.quiz_id = q.id AND p.user_id = @userId
   ORDER BY
     CASE
       WHEN q.start_at <= @now AND q.end_at >= @now THEN 0
       WHEN q.start_at > @now THEN 1
       ELSE 2
     END,
     CASE
       WHEN q.start_at <= @now AND q.end_at >= @now THEN q.end_at
       ELSE NULL
     END ASC,
     CASE
       WHEN q.start_at > @now THEN q.start_at
       ELSE NULL
     END ASC,
     CASE
       WHEN q.start_at <= @now AND q.end_at >= @now THEN NULL
       WHEN q.start_at > @now THEN NULL
       ELSE q.end_at
     END DESC`,
);

export interface QuizRow {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  timeLimitSeconds: number;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
}

interface QuizIdParam {
  quizId: string;
}

interface ParticipationParams {
  userId: string;
  quizId: string;
}

const selectQuizByIdStmt = db.prepare<QuizIdParam, QuizRow>(
  `SELECT
     id,
     title,
     description,
     question_count AS questionCount,
     time_limit_seconds AS timeLimitSeconds,
     start_at AS startAt,
     end_at AS endAt,
     created_at AS createdAt,
     updated_at AS updatedAt
   FROM quizzes
   WHERE id = @quizId`,
);

interface CountRow {
  count: number;
}

const countParticipationStmt = db.prepare<ParticipationParams, CountRow>(
  `SELECT COUNT(*) AS count
   FROM participations
   WHERE user_id = @userId AND quiz_id = @quizId`,
);

const countQuestionsStmt = db.prepare<QuizIdParam, CountRow>(
  `SELECT COUNT(*) AS count
   FROM questions
   WHERE quiz_id = @quizId`,
);

export interface QuestionRow {
  id: string;
  prompt: string;
  /** JSON text of the options array — parsed at a higher layer, not here. */
  options: string;
  correctOpt: number;
}

interface QuestionIdParam {
  quizId: string;
  questionId: string;
}

interface QuestionIdRow {
  id: string;
}

const selectQuestionIdsStmt = db.prepare<QuizIdParam, QuestionIdRow>(
  `SELECT id
   FROM questions
   WHERE quiz_id = @quizId
   ORDER BY seq`,
);

interface QuestionIdCategoryRow extends QuestionIdRow {
  category: string;
}

const selectQuestionIdsByCategoryStmt = db.prepare<QuizIdParam, QuestionIdCategoryRow>(
  `SELECT id, category
   FROM questions
   WHERE quiz_id = @quizId
   ORDER BY seq`,
);

const selectQuestionByIdStmt = db.prepare<QuestionIdParam, QuestionRow>(
  `SELECT
     id,
     prompt,
     options,
     correct_opt AS correctOpt
   FROM questions
   WHERE quiz_id = @quizId AND id = @questionId`,
);

interface InsertParticipationParams {
  userId: string;
  quizId: string;
  score: number;
  durationMs: number;
}

const insertParticipationStmt = db.prepare<InsertParticipationParams>(
  `INSERT INTO participations (user_id, quiz_id, score, duration_ms)
   VALUES (@userId, @quizId, @score, @durationMs)`,
);

export interface ParticipationRow {
  score: number;
  durationMs: number;
}

const selectParticipationStmt = db.prepare<ParticipationParams, ParticipationRow>(
  `SELECT
     score,
     duration_ms AS durationMs
   FROM participations
   WHERE user_id = @userId AND quiz_id = @quizId`,
);

export interface LeaderboardEntryRow {
  name: string;
  score: number;
  durationMs: number;
}

interface LeaderboardParams {
  quizId: string;
  limit: number;
  offset: number;
}

const selectLeaderboardStmt = db.prepare<LeaderboardParams, LeaderboardEntryRow>(
  `SELECT
     users.name,
     participations.score,
     participations.duration_ms AS durationMs
   FROM participations
   JOIN users ON users.id = participations.user_id
   WHERE participations.quiz_id = @quizId
   ORDER BY participations.score DESC, participations.duration_ms ASC
   LIMIT @limit OFFSET @offset`,
);

interface TotalRow {
  total: number;
}

const countLeaderboardStmt = db.prepare<QuizIdParam, TotalRow>(
  `SELECT COUNT(*) AS total
   FROM participations
   WHERE quiz_id = @quizId`,
);

// --- Admin helpers ---

export interface QuizInput {
  title: string;
  description: string;
  questionCount: number;
  timeLimitSeconds: number;
  startAt: string;
  endAt: string;
}

interface InsertQuizParams extends QuizInput {
  id: string;
}

const insertQuizStmt = db.prepare<InsertQuizParams, QuizRow>(
  `INSERT INTO quizzes (id, title, description, question_count, time_limit_seconds, start_at, end_at)
   VALUES (@id, @title, @description, @questionCount, @timeLimitSeconds, @startAt, @endAt)
   RETURNING
     id,
     title,
     description,
     question_count AS questionCount,
     time_limit_seconds AS timeLimitSeconds,
     start_at AS startAt,
     end_at AS endAt,
     created_at AS createdAt,
     updated_at AS updatedAt`,
);

interface UpdateQuizParams extends QuizInput {
  id: string;
}

const updateQuizStmt = db.prepare<UpdateQuizParams, QuizRow>(
  `UPDATE quizzes
   SET title = @title,
       description = @description,
       question_count = @questionCount,
       time_limit_seconds = @timeLimitSeconds,
       start_at = @startAt,
       end_at = @endAt,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
   WHERE id = @id
   RETURNING
     id,
     title,
     description,
     question_count AS questionCount,
     time_limit_seconds AS timeLimitSeconds,
     start_at AS startAt,
     end_at AS endAt,
     created_at AS createdAt,
     updated_at AS updatedAt`,
);

const deleteQuizStmt = db.prepare<QuizIdParam>('DELETE FROM quizzes WHERE id = @quizId');

const deleteParticipationsByQuizStmt = db.prepare<QuizIdParam>(
  'DELETE FROM participations WHERE quiz_id = @quizId',
);

export interface AdminQuizRow extends QuizRow {
  questionBankSize: number;
  attemptCount: number;
}

const selectAdminQuizzesStmt = db.prepare<Record<string, never>, AdminQuizRow>(
  `SELECT
     q.id,
     q.title,
     q.description,
     q.question_count AS questionCount,
     q.time_limit_seconds AS timeLimitSeconds,
     q.start_at AS startAt,
     q.end_at AS endAt,
     q.created_at AS createdAt,
     q.updated_at AS updatedAt,
     (SELECT COUNT(*) FROM questions qs WHERE qs.quiz_id = q.id) AS questionBankSize,
     (SELECT COUNT(*) FROM participations p WHERE p.quiz_id = q.id) AS attemptCount
   FROM quizzes q
   ORDER BY q.created_at DESC, q.id`,
);

export interface AdminQuestionRow extends QuestionRow {
  seq: number;
  category: string;
}

const selectAdminQuestionsStmt = db.prepare<QuizIdParam, AdminQuestionRow>(
  `SELECT
     id,
     seq,
     prompt,
     options,
     correct_opt AS correctOpt,
     category
   FROM questions
   WHERE quiz_id = @quizId
   ORDER BY seq`,
);

const selectAdminQuestionByIdStmt = db.prepare<QuestionIdParam, AdminQuestionRow>(
  `SELECT
     id,
     seq,
     prompt,
     options,
     correct_opt AS correctOpt,
     category
   FROM questions
   WHERE quiz_id = @quizId AND id = @questionId`,
);

interface InsertQuestionParams {
  quizId: string;
  questionId: string;
  seq: number;
  prompt: string;
  options: string;
  correctOpt: number;
  category: string;
}

const insertQuestionStmt = db.prepare<InsertQuestionParams, AdminQuestionRow>(
  `INSERT INTO questions (id, quiz_id, seq, prompt, options, correct_opt, category)
   VALUES (@questionId, @quizId, @seq, @prompt, @options, @correctOpt, @category)
   RETURNING
     id,
     seq,
     prompt,
     options,
     correct_opt AS correctOpt,
     category`,
);

interface UpdateQuestionParams {
  questionId: string;
  prompt: string;
  options: string;
  correctOpt: number;
  category: string;
}

const updateQuestionStmt = db.prepare<UpdateQuestionParams, AdminQuestionRow>(
  `UPDATE questions
   SET prompt = @prompt,
       options = @options,
       correct_opt = @correctOpt,
       category = @category
   WHERE id = @questionId
   RETURNING
     id,
     seq,
     prompt,
     options,
     correct_opt AS correctOpt,
     category`,
);

interface QuestionIdOnlyParam {
  questionId: string;
}

const deleteQuestionStmt = db.prepare<QuestionIdOnlyParam>(
  'DELETE FROM questions WHERE id = @questionId',
);

const countAttemptsStmt = db.prepare<QuizIdParam, CountRow>(
  `SELECT COUNT(*) AS count
   FROM participations
   WHERE quiz_id = @quizId`,
);

interface MaxSeqRow {
  maxSeq: number | null;
}

const maxQuestionSeqStmt = db.prepare<QuizIdParam, MaxSeqRow>(
  'SELECT MAX(seq) AS maxSeq FROM questions WHERE quiz_id = @quizId',
);

export const quizzes = {
  listForUser(userId: string, now: string): QuizListRow[] {
    return selectQuizzesForUserStmt.all({ userId, now });
  },

  getById(quizId: string): QuizRow | undefined {
    return selectQuizByIdStmt.get({ quizId });
  },

  hasParticipation(userId: string, quizId: string): boolean {
    return countParticipationStmt.get({ userId, quizId })!.count > 0;
  },

  countQuestions(quizId: string): number {
    return countQuestionsStmt.get({ quizId })!.count;
  },

  listQuestionIds(quizId: string): string[] {
    return selectQuestionIdsStmt.all({ quizId }).map((row) => row.id);
  },

  listQuestionIdsByCategory(quizId: string): { faq: string[]; general: string[] } {
    const pools = { faq: [] as string[], general: [] as string[] };
    for (const row of selectQuestionIdsByCategoryStmt.all({ quizId })) {
      (row.category === 'faq' ? pools.faq : pools.general).push(row.id);
    }
    return pools;
  },

  getQuestionById(quizId: string, questionId: string): QuestionRow | undefined {
    return selectQuestionByIdStmt.get({ quizId, questionId });
  },

  insertParticipation(
    userId: string,
    quizId: string,
    score: number,
    durationMs: number,
  ): void {
    insertParticipationStmt.run({ userId, quizId, score, durationMs });
  },

  getParticipation(userId: string, quizId: string): ParticipationRow | undefined {
    return selectParticipationStmt.get({ userId, quizId });
  },

  listLeaderboard(quizId: string, limit: number, offset: number): LeaderboardEntryRow[] {
    return selectLeaderboardStmt.all({ quizId, limit, offset });
  },

  countLeaderboard(quizId: string): number {
    return countLeaderboardStmt.get({ quizId })!.total;
  },

  insertQuiz(input: QuizInput): QuizRow {
    return insertQuizStmt.get({ id: randomUUID(), ...input })!;
  },

  updateQuiz(id: string, input: QuizInput): QuizRow | undefined {
    return updateQuizStmt.get({ id, ...input });
  },

  deleteQuiz(id: string): void {
    deleteQuizStmt.run({ quizId: id });
  },

  deleteParticipationsByQuiz(quizId: string): void {
    deleteParticipationsByQuizStmt.run({ quizId });
  },

  listAdminQuizzes(): AdminQuizRow[] {
    return selectAdminQuizzesStmt.all({});
  },

  listQuestions(quizId: string): AdminQuestionRow[] {
    return selectAdminQuestionsStmt.all({ quizId });
  },

  findQuestionById(quizId: string, questionId: string): AdminQuestionRow | undefined {
    return selectAdminQuestionByIdStmt.get({ quizId, questionId });
  },

  insertQuestion(
    quizId: string,
    questionId: string,
    seq: number,
    prompt: string,
    optionsJson: string,
    correctOpt: number,
    category: string,
  ): AdminQuestionRow {
    return insertQuestionStmt.get({
      quizId,
      questionId,
      seq,
      prompt,
      options: optionsJson,
      correctOpt,
      category,
    })!;
  },

  updateQuestion(
    questionId: string,
    prompt: string,
    optionsJson: string,
    correctOpt: number,
    category: string,
  ): AdminQuestionRow | undefined {
    return updateQuestionStmt.get({
      questionId,
      prompt,
      options: optionsJson,
      correctOpt,
      category,
    });
  },

  deleteQuestion(questionId: string): void {
    deleteQuestionStmt.run({ questionId });
  },

  countAttempts(quizId: string): number {
    return countAttemptsStmt.get({ quizId })!.count;
  },

  maxQuestionSeq(quizId: string): number | null {
    return maxQuestionSeqStmt.get({ quizId })!.maxSeq;
  },
};
