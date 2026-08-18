import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';

const ADMIN_ID = 'admin-q-1';
const PLAYER_ID = 'player-q-1';

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

function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function adminToken(): string {
  return jwt.sign({ userId: ADMIN_ID, isAdmin: true }, 'test-jwt-secret', { expiresIn: '2h' });
}

function playerToken(): string {
  return jwt.sign({ userId: PLAYER_ID, isAdmin: false }, 'test-jwt-secret', { expiresIn: '2h' });
}

function adminRequest(method: 'post' | 'get' | 'put' | 'delete', url: string, body?: unknown) {
  const req = request(app)[method](url).set('Authorization', `Bearer ${adminToken()}`);
  return body !== undefined ? req.send(body) : req;
}

function seedQuiz(id: string, questionBank = 2): void {
  insertQuizStmt.run(
    id,
    `Quiz ${id}`,
    `${id} description`,
    Math.min(questionBank, 2),
    15,
    isoFromNow(-HOUR_MS),
    isoFromNow(DAY_MS),
  );
  for (let i = 0; i < questionBank; i++) {
    insertQuestionStmt.run(`${id}-q${i + 1}`, id, i + 1, `Prompt ${i + 1}?`, '["A","B"]', 0);
  }
}

const validQuestionBody = {
  text: 'What is the capital of France?',
  options: ['Berlin', 'Paris', 'Madrid'],
  correctOpt: 1,
};

beforeAll(() => {
  insertUserStmt.run(ADMIN_ID, 'admin-q@nanoquiz.app', 'Admin Q', 'sub-admin-q');
  insertUserStmt.run(PLAYER_ID, 'player-q@nanoquiz.app', 'Player Q', 'sub-player-q');
});

beforeEach(() => {
  clearParticipationsStmt.run();
  clearQuestionsStmt.run();
  clearQuizzesStmt.run();
});

describe('GET /api/admin/quizzes/:id/questions', () => {
  it('should_return_401_when_authorization_header_is_missing', async () => {
    seedQuiz('aq-get');

    const res = await request(app).get('/api/admin/quizzes/aq-get/questions');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_return_403_when_token_has_is_admin_false', async () => {
    seedQuiz('aq-get');

    const res = await request(app)
      .get('/api/admin/quizzes/aq-get/questions')
      .set('Authorization', `Bearer ${playerToken()}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN', message: 'Admin access required.' });
  });

  it('should_return_questions_with_correct_opt_in_seq_order', async () => {
    seedQuiz('aq-get-list', 3);

    const res = await adminRequest('get', '/api/admin/quizzes/aq-get-list/questions');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(Object.keys(res.body[0]).sort()).toEqual(['correctOpt', 'id', 'options', 'text']);
    expect(res.body.map((q: { text: string }) => q.text)).toEqual([
      'Prompt 1?',
      'Prompt 2?',
      'Prompt 3?',
    ]);
    expect(res.body[0].options).toEqual(['A', 'B']);
    expect(res.body[0].correctOpt).toBe(0);
  });

  it('should_return_404_when_quiz_is_unknown', async () => {
    const res = await adminRequest('get', '/api/admin/quizzes/no-such-quiz/questions');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

describe('POST /api/admin/quizzes/:id/questions', () => {
  it('should_return_401_when_authorization_header_is_missing', async () => {
    seedQuiz('aq-post');

    const res = await request(app).post('/api/admin/quizzes/aq-post/questions').send(validQuestionBody);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_return_403_when_token_has_is_admin_false', async () => {
    seedQuiz('aq-post');

    const res = await request(app)
      .post('/api/admin/quizzes/aq-post/questions')
      .set('Authorization', `Bearer ${playerToken()}`)
      .send(validQuestionBody);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN', message: 'Admin access required.' });
  });

  it('should_return_201_with_created_question_when_body_is_valid', async () => {
    seedQuiz('aq-post-create', 1);

    const res = await adminRequest('post', '/api/admin/quizzes/aq-post-create/questions', validQuestionBody);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(['correctOpt', 'id', 'options', 'text']);
    expect(res.body.text).toBe(validQuestionBody.text);
    expect(res.body.options).toEqual(['Berlin', 'Paris', 'Madrid']);
    expect(res.body.correctOpt).toBe(1);

    // Appended after the existing bank (seq 2).
    const list = await adminRequest('get', '/api/admin/quizzes/aq-post-create/questions');
    expect(list.body).toHaveLength(2);
    expect(list.body[1].id).toBe(res.body.id);
  });

  it('should_return_404_when_quiz_is_unknown', async () => {
    const res = await adminRequest('post', '/api/admin/quizzes/no-such-quiz/questions', validQuestionBody);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('should_return_400_when_text_is_empty', async () => {
    seedQuiz('aq-post-val');

    const res = await adminRequest('post', '/api/admin/quizzes/aq-post-val/questions', {
      ...validQuestionBody,
      text: '   ',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_options_has_fewer_than_two_entries', async () => {
    seedQuiz('aq-post-val');

    const res = await adminRequest('post', '/api/admin/quizzes/aq-post-val/questions', {
      ...validQuestionBody,
      options: ['Only one'],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_an_option_is_an_empty_string', async () => {
    seedQuiz('aq-post-val');

    const res = await adminRequest('post', '/api/admin/quizzes/aq-post-val/questions', {
      ...validQuestionBody,
      options: ['Berlin', '  '],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_correct_opt_is_negative', async () => {
    seedQuiz('aq-post-val');

    const res = await adminRequest('post', '/api/admin/quizzes/aq-post-val/questions', {
      ...validQuestionBody,
      correctOpt: -1,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_correct_opt_is_not_an_integer', async () => {
    seedQuiz('aq-post-val');

    const res = await adminRequest('post', '/api/admin/quizzes/aq-post-val/questions', {
      ...validQuestionBody,
      correctOpt: 1.5,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_correct_opt_is_out_of_range', async () => {
    seedQuiz('aq-post-val');

    const res = await adminRequest('post', '/api/admin/quizzes/aq-post-val/questions', {
      ...validQuestionBody,
      correctOpt: 3,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/admin/quizzes/:id/questions/:questionId', () => {
  it('should_return_401_when_authorization_header_is_missing', async () => {
    seedQuiz('aq-put');

    const res = await request(app)
      .put('/api/admin/quizzes/aq-put/questions/aq-put-q1')
      .send(validQuestionBody);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_return_403_when_token_has_is_admin_false', async () => {
    seedQuiz('aq-put');

    const res = await request(app)
      .put('/api/admin/quizzes/aq-put/questions/aq-put-q1')
      .set('Authorization', `Bearer ${playerToken()}`)
      .send(validQuestionBody);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN', message: 'Admin access required.' });
  });

  it('should_return_200_with_updated_question_when_body_is_valid', async () => {
    seedQuiz('aq-put-ok');

    const res = await adminRequest(
      'put',
      '/api/admin/quizzes/aq-put-ok/questions/aq-put-ok-q1',
      validQuestionBody,
    );

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['correctOpt', 'id', 'options', 'text']);
    expect(res.body.id).toBe('aq-put-ok-q1');
    expect(res.body.text).toBe(validQuestionBody.text);
    expect(res.body.options).toEqual(['Berlin', 'Paris', 'Madrid']);
    expect(res.body.correctOpt).toBe(1);
  });

  it('should_return_409_when_quiz_has_attempts', async () => {
    seedQuiz('aq-put-attempted');
    insertParticipationStmt.run(PLAYER_ID, 'aq-put-attempted', 1, 30_000);

    const res = await adminRequest(
      'put',
      '/api/admin/quizzes/aq-put-attempted/questions/aq-put-attempted-q1',
      validQuestionBody,
    );

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('QUIZ_HAS_ATTEMPTS');
  });

  it('should_return_400_when_body_is_invalid', async () => {
    seedQuiz('aq-put-val');

    const res = await adminRequest('put', '/api/admin/quizzes/aq-put-val/questions/aq-put-val-q1', {
      ...validQuestionBody,
      text: '',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_404_when_quiz_is_unknown', async () => {
    const res = await adminRequest(
      'put',
      '/api/admin/quizzes/no-such-quiz/questions/some-question',
      validQuestionBody,
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('should_return_404_when_question_is_unknown', async () => {
    seedQuiz('aq-put-missing');

    const res = await adminRequest(
      'put',
      '/api/admin/quizzes/aq-put-missing/questions/no-such-question',
      validQuestionBody,
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('should_return_404_when_question_belongs_to_another_quiz', async () => {
    seedQuiz('aq-put-a');
    seedQuiz('aq-put-b');

    const res = await adminRequest(
      'put',
      '/api/admin/quizzes/aq-put-b/questions/aq-put-a-q1',
      validQuestionBody,
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/admin/quizzes/:id/questions/:questionId', () => {
  it('should_return_401_when_authorization_header_is_missing', async () => {
    seedQuiz('aq-del');

    const res = await request(app).delete('/api/admin/quizzes/aq-del/questions/aq-del-q1');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_return_403_when_token_has_is_admin_false', async () => {
    seedQuiz('aq-del');

    const res = await request(app)
      .delete('/api/admin/quizzes/aq-del/questions/aq-del-q1')
      .set('Authorization', `Bearer ${playerToken()}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN', message: 'Admin access required.' });
  });

  it('should_return_204_and_remove_question_when_it_exists', async () => {
    seedQuiz('aq-del-ok');

    const res = await adminRequest('delete', '/api/admin/quizzes/aq-del-ok/questions/aq-del-ok-q1');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    const list = await adminRequest('get', '/api/admin/quizzes/aq-del-ok/questions');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe('aq-del-ok-q2');
  });

  it('should_return_409_when_quiz_has_attempts', async () => {
    seedQuiz('aq-del-attempted');
    insertParticipationStmt.run(PLAYER_ID, 'aq-del-attempted', 1, 30_000);

    const res = await adminRequest(
      'delete',
      '/api/admin/quizzes/aq-del-attempted/questions/aq-del-attempted-q1',
    );

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('QUIZ_HAS_ATTEMPTS');
  });

  it('should_return_404_when_quiz_is_unknown', async () => {
    const res = await adminRequest('delete', '/api/admin/quizzes/no-such-quiz/questions/some-q');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('should_return_404_when_question_is_unknown', async () => {
    seedQuiz('aq-del-missing');

    const res = await adminRequest('delete', '/api/admin/quizzes/aq-del-missing/questions/nope');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('should_return_404_when_question_belongs_to_another_quiz', async () => {
    seedQuiz('aq-del-a');
    seedQuiz('aq-del-b');

    const res = await adminRequest('delete', '/api/admin/quizzes/aq-del-b/questions/aq-del-a-q1');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

describe('contestant question fetch (answer-leak regression)', () => {
  it('should_omit_correct_opt_keys_when_question_is_served_to_a_contestant', async () => {
    seedQuiz('aq-leak', 2);

    const start = await request(app)
      .post('/api/quizzes/aq-leak/start')
      .set('Authorization', `Bearer ${playerToken()}`);
    expect(start.status).toBe(200);

    const res = await request(app)
      .get('/api/quizzes/aq-leak/question/1')
      .query({ seed: start.body.seed as string })
      .set('Authorization', `Bearer ${playerToken()}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['options', 'seq', 'text', 'total']);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('correctOpt');
    expect(serialized).not.toContain('correct_opt');
  });
});
