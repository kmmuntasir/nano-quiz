import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';

const USER_ID = 'user-quiz-start-1';

const HOUR_MS = 60 * 60_000;

const insertUserStmt = db.prepare(
  'INSERT INTO users (id, email, name, google_sub) VALUES (?, ?, ?, ?)',
);
const insertQuizStmt = db.prepare(
  `INSERT INTO quizzes (id, title, description, question_count, time_limit_seconds, start_at, end_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const insertQuestionStmt = db.prepare(
  `INSERT INTO questions (id, quiz_id, seq, prompt, options, correct_opt)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const insertParticipationStmt = db.prepare(
  `INSERT INTO participations (user_id, quiz_id, score, duration_ms)
   VALUES (?, ?, ?, ?)`,
);
const clearQuizzesStmt = db.prepare('DELETE FROM quizzes');
const clearQuestionsStmt = db.prepare('DELETE FROM questions');
const clearParticipationsStmt = db.prepare('DELETE FROM participations');

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

interface QuizFixture {
  id: string;
  questionCount?: number;
  startOffsetMs: number;
  endOffsetMs: number;
}

function insertQuiz(fixture: QuizFixture): void {
  insertQuizStmt.run(
    fixture.id,
    `Quiz ${fixture.id}`,
    `${fixture.id} description`,
    fixture.questionCount ?? 2,
    15,
    iso(fixture.startOffsetMs),
    iso(fixture.endOffsetMs),
  );
  insertQuestionStmt.run(
    `${fixture.id}-q1`,
    fixture.id,
    1,
    'Prompt 1?',
    '["A","B"]',
    0,
  );
  insertQuestionStmt.run(
    `${fixture.id}-q2`,
    fixture.id,
    2,
    'Prompt 2?',
    '["A","B"]',
    1,
  );
}

function authedPost(url: string): request.Test {
  const token = jwt.sign({ userId: USER_ID, isAdmin: false }, 'test-jwt-secret', {
    expiresIn: '2h',
  });
  return request(app).post(url).set('Authorization', `Bearer ${token}`);
}

function tableCount(table: string): number {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
}

beforeAll(() => {
  insertUserStmt.run(USER_ID, 'quiz-starter@nanoquiz.app', 'Quiz Starter', 'sub-quiz-starter');
});

beforeEach(() => {
  clearParticipationsStmt.run();
  clearQuestionsStmt.run();
  clearQuizzesStmt.run();
});

describe('POST /api/quizzes/:id/start', () => {
  it('should_return_session_without_persisting_when_quiz_is_live', async () => {
    insertQuiz({ id: 'q-live', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });
    const before = {
      quizzes: tableCount('quizzes').n,
      participations: tableCount('participations').n,
      questions: tableCount('questions').n,
    };

    const res = await authedPost('/api/quizzes/q-live/start');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['questionCount', 'quizId', 'seed', 'timeLimitSeconds'].sort(),
    );
    expect(res.body.seed).toMatch(/^[0-9a-f]{10}$/);
    expect(res.body.quizId).toBe('q-live');
    expect(res.body.questionCount).toBe(2);
    expect(res.body.timeLimitSeconds).toBe(15);
    const after = {
      quizzes: tableCount('quizzes').n,
      participations: tableCount('participations').n,
      questions: tableCount('questions').n,
    };
    expect(after).toEqual(before);
  });

  it('should_return_403_when_now_is_before_start_at', async () => {
    insertQuiz({ id: 'q-future', startOffsetMs: HOUR_MS, endOffsetMs: 2 * HOUR_MS });

    const res = await authedPost('/api/quizzes/q-future/start');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('QUIZ_NOT_ACTIVE');
  });

  it('should_return_403_when_now_is_after_end_at', async () => {
    insertQuiz({ id: 'q-past', startOffsetMs: -2 * HOUR_MS, endOffsetMs: -HOUR_MS });

    const res = await authedPost('/api/quizzes/q-past/start');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('QUIZ_NOT_ACTIVE');
  });

  it('should_return_200_when_now_is_exactly_start_at', async () => {
    insertQuiz({ id: 'q-at-start', startOffsetMs: -1, endOffsetMs: HOUR_MS });

    const res = await authedPost('/api/quizzes/q-at-start/start');

    expect(res.status).toBe(200);
    expect(res.body.quizId).toBe('q-at-start');
  });

  it('should_return_200_when_now_is_exactly_end_at', async () => {
    insertQuiz({ id: 'q-at-end', startOffsetMs: -HOUR_MS, endOffsetMs: 1000 });

    const res = await authedPost('/api/quizzes/q-at-end/start');

    expect(res.status).toBe(200);
    expect(res.body.quizId).toBe('q-at-end');
  });

  it('should_return_409_when_user_already_participated', async () => {
    insertQuiz({ id: 'q-taken', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });
    insertParticipationStmt.run(USER_ID, 'q-taken', 2, 30_000);

    const res = await authedPost('/api/quizzes/q-taken/start');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_PARTICIPATED');
  });

  it('should_return_409_when_question_bank_is_smaller_than_question_count', async () => {
    insertQuiz({ id: 'q-thin', questionCount: 3, startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });

    const res = await authedPost('/api/quizzes/q-thin/start');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('INSUFFICIENT_QUESTIONS');
  });

  it('should_return_404_when_quiz_id_is_unknown', async () => {
    const res = await authedPost('/api/quizzes/no-such-quiz/start');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('should_return_401_when_authorization_header_is_missing', async () => {
    const res = await request(app).post('/api/quizzes/q-live/start');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });
});
