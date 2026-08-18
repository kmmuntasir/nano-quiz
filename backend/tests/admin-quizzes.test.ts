import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';

const ADMIN_ID = 'admin-crud-1';
const PLAYER_ID = 'player-crud-1';

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

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
const insertUserStmt = db.prepare(
  'INSERT INTO users (id, email, name, google_sub) VALUES (?, ?, ?, ?)',
);
const clearParticipationsStmt = db.prepare('DELETE FROM participations');
const clearQuestionsStmt = db.prepare('DELETE FROM questions');
const clearQuizzesStmt = db.prepare('DELETE FROM quizzes');
const countQuizzesStmt = db.prepare('SELECT COUNT(*) AS count FROM quizzes');
const countQuestionsStmt = db.prepare('SELECT COUNT(*) AS count FROM questions');
const countParticipationsStmt = db.prepare('SELECT COUNT(*) AS count FROM participations');

function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function adminToken(): string {
  return jwt.sign({ userId: ADMIN_ID, isAdmin: true }, 'test-jwt-secret', { expiresIn: '2h' });
}

function userToken(): string {
  return jwt.sign({ userId: PLAYER_ID, isAdmin: false }, 'test-jwt-secret', { expiresIn: '2h' });
}

function adminRequest(method: 'post' | 'get' | 'put' | 'delete', url: string, body?: unknown) {
  const req = request(app)[method](url).set('Authorization', `Bearer ${adminToken()}`);
  return body !== undefined ? req.send(body) : req;
}

interface QuizFixture {
  id: string;
  title?: string;
  questionCount?: number;
  questionBank?: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
}

function seedQuiz(fixture: QuizFixture): void {
  const questionCount = fixture.questionCount ?? 2;
  insertQuizStmt.run(
    fixture.id,
    fixture.title ?? `Quiz ${fixture.id}`,
    `${fixture.id} description`,
    questionCount,
    15,
    isoFromNow(fixture.startOffsetMs ?? -HOUR_MS),
    isoFromNow(fixture.endOffsetMs ?? DAY_MS),
  );
  for (let i = 0; i < (fixture.questionBank ?? questionCount); i++) {
    insertQuestionStmt.run(
      `${fixture.id}-q${i + 1}`,
      fixture.id,
      i + 1,
      `Prompt ${i + 1}?`,
      '["A","B"]',
      0,
    );
  }
}

const validCreateBody = {
  title: 'Created Quiz',
  description: 'A brand new quiz',
  questionCount: 3,
  startAt: isoFromNow(HOUR_MS),
  endAt: isoFromNow(2 * DAY_MS),
};

beforeAll(() => {
  insertUserStmt.run(ADMIN_ID, 'admin-crud@nanoquiz.app', 'Admin Crud', 'sub-admin-crud');
  insertUserStmt.run(PLAYER_ID, 'player-crud@nanoquiz.app', 'Player Crud', 'sub-player-crud');
});

beforeEach(() => {
  clearParticipationsStmt.run();
  clearQuestionsStmt.run();
  clearQuizzesStmt.run();
});

describe('POST /api/admin/quizzes', () => {
  it('should_return_401_when_authorization_header_is_missing', async () => {
    const res = await request(app).post('/api/admin/quizzes').send(validCreateBody);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_return_403_when_token_has_is_admin_false', async () => {
    const res = await request(app)
      .post('/api/admin/quizzes')
      .set('Authorization', `Bearer ${userToken()}`)
      .send(validCreateBody);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN', message: 'Admin access required.' });
  });

  it('should_return_201_with_created_quiz_when_body_is_valid', async () => {
    const res = await adminRequest('post', '/api/admin/quizzes', validCreateBody);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'id',
        'title',
        'description',
        'questionCount',
        'timeLimitSeconds',
        'startAt',
        'endAt',
      ].sort(),
    );
    expect(res.body.title).toBe('Created Quiz');
    expect(res.body.description).toBe('A brand new quiz');
    expect(res.body.questionCount).toBe(3);
    expect(res.body.timeLimitSeconds).toBe(15); // default applied
    expect(res.body.startAt).toBe(validCreateBody.startAt);
    expect(res.body.endAt).toBe(validCreateBody.endAt);
  });

  it('should_return_400_when_title_is_empty', async () => {
    const res = await adminRequest('post', '/api/admin/quizzes', {
      ...validCreateBody,
      title: '   ',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_question_count_is_zero', async () => {
    const res = await adminRequest('post', '/api/admin/quizzes', {
      ...validCreateBody,
      questionCount: 0,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_question_count_is_negative', async () => {
    const res = await adminRequest('post', '/api/admin/quizzes', {
      ...validCreateBody,
      questionCount: -1,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_question_count_is_not_an_integer', async () => {
    const res = await adminRequest('post', '/api/admin/quizzes', {
      ...validCreateBody,
      questionCount: 2.5,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_end_at_is_not_after_start_at', async () => {
    const same = isoFromNow(HOUR_MS);
    const res = await adminRequest('post', '/api/admin/quizzes', {
      ...validCreateBody,
      startAt: same,
      endAt: same,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_dates_are_malformed', async () => {
    const res = await adminRequest('post', '/api/admin/quizzes', {
      ...validCreateBody,
      startAt: 'not-a-date',
      endAt: isoFromNow(DAY_MS),
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/admin/quizzes', () => {
  it('should_return_401_when_authorization_header_is_missing', async () => {
    const res = await request(app).get('/api/admin/quizzes');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_return_403_when_token_has_is_admin_false', async () => {
    const res = await request(app)
      .get('/api/admin/quizzes')
      .set('Authorization', `Bearer ${userToken()}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN', message: 'Admin access required.' });
  });

  it('should_return_bank_size_and_attempt_count_when_quiz_has_questions_and_participation', async () => {
    seedQuiz({ id: 'aq-list', questionCount: 2, questionBank: 4 });
    insertParticipationStmt.run(PLAYER_ID, 'aq-list', 1, 30_000);

    const res = await adminRequest('get', '/api/admin/quizzes');

    expect(res.status).toBe(200);
    const item = res.body.find((q: { id: string }) => q.id === 'aq-list');
    expect(item.questionBankSize).toBe(4);
    expect(item.attemptCount).toBe(1);
    expect(Object.keys(item).sort()).toEqual(
      [
        'id',
        'title',
        'description',
        'questionCount',
        'timeLimitSeconds',
        'startAt',
        'endAt',
        'questionBankSize',
        'attemptCount',
      ].sort(),
    );
  });
});

describe('PUT /api/admin/quizzes/:id', () => {
  const editBody = {
    title: 'Edited Quiz',
    description: 'Edited description',
    questionCount: 2,
    timeLimitSeconds: 20,
    startAt: isoFromNow(-HOUR_MS),
    endAt: isoFromNow(DAY_MS),
  };

  it('should_return_200_with_updated_quiz_when_body_is_valid', async () => {
    seedQuiz({ id: 'aq-edit' });

    const res = await adminRequest('put', '/api/admin/quizzes/aq-edit', editBody);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Edited Quiz');
    expect(res.body.timeLimitSeconds).toBe(20);
    expect(res.body.questionCount).toBe(2);
  });

  it('should_return_409_when_quiz_has_attempts', async () => {
    seedQuiz({ id: 'aq-edit-attempted' });
    insertParticipationStmt.run(PLAYER_ID, 'aq-edit-attempted', 1, 30_000);

    const res = await adminRequest('put', '/api/admin/quizzes/aq-edit-attempted', editBody);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'QUIZ_HAS_ATTEMPTS',
      message: expect.any(String) as string,
    });
  });

  it('should_return_400_when_question_count_exceeds_question_bank_size', async () => {
    seedQuiz({ id: 'aq-edit-bank', questionBank: 2 });

    const res = await adminRequest('put', '/api/admin/quizzes/aq-edit-bank', {
      ...editBody,
      questionCount: 3,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('questionCount exceeds the question bank size.');
  });

  it('should_return_404_when_quiz_is_unknown', async () => {
    const res = await adminRequest('put', '/api/admin/quizzes/does-not-exist', editBody);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/admin/quizzes/:id', () => {
  it('should_return_204_and_remove_quiz_questions_and_participations_when_quiz_exists', async () => {
    seedQuiz({ id: 'aq-delete' });
    insertParticipationStmt.run(PLAYER_ID, 'aq-delete', 1, 30_000);

    const res = await adminRequest('delete', '/api/admin/quizzes/aq-delete');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(countQuizzesStmt.get()!.count).toBe(0);
    expect(countQuestionsStmt.get()!.count).toBe(0);
    expect(countParticipationsStmt.get()!.count).toBe(0);
  });

  it('should_return_404_when_quiz_is_unknown', async () => {
    const res = await adminRequest('delete', '/api/admin/quizzes/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});
