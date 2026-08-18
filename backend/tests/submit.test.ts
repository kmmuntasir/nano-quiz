import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { deriveQuestionOrder } from '../src/utils/shuffle.js';

const USER_ID = 'user-submit-1';
const ADMIN_ID = 'admin-submit-1';

const HOUR_MS = 60 * 60_000;

const SEED = '0000000001';

const QUESTION_IDS = ['q1', 'q2', 'q3', 'q4'];
const QUESTION_COUNT = 3;
// correct_opt per question id — mixed so scoring is order-sensitive.
const CORRECT_OPT: Record<string, number> = { q1: 0, q2: 1, q3: 0, q4: 1 };
const OPTIONS_JSON: Record<string, string> = {
  q1: '["Q1 A","Q1 B"]',
  q2: '["Q2 A","Q2 B"]',
  q3: '["Q3 A","Q3 B","Q3 C"]',
  q4: '["Q4 A","Q4 B"]',
};

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
const clearQuizzesStmt = db.prepare('DELETE FROM quizzes');
const clearQuestionsStmt = db.prepare('DELETE FROM questions');
const clearParticipationsStmt = db.prepare('DELETE FROM participations');
const countParticipationsStmt = db.prepare(
  'SELECT COUNT(*) AS count FROM participations WHERE user_id = ? AND quiz_id = ?',
);
const selectParticipationRowStmt = db.prepare(
  'SELECT score, duration_ms FROM participations WHERE user_id = ? AND quiz_id = ?',
);

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function insertQuiz(fixture: { id: string; startOffsetMs?: number; endOffsetMs?: number }): void {
  insertQuizStmt.run(
    fixture.id,
    `Quiz ${fixture.id}`,
    `${fixture.id} description`,
    QUESTION_COUNT,
    15,
    iso(fixture.startOffsetMs ?? -HOUR_MS),
    iso(fixture.endOffsetMs ?? HOUR_MS),
  );
  QUESTION_IDS.forEach((questionId, index) => {
    insertQuestionStmt.run(
      questionId,
      fixture.id,
      index + 1,
      `Prompt ${questionId}?`,
      OPTIONS_JSON[questionId],
      CORRECT_OPT[questionId],
    );
  });
}

function token(): string {
  return jwt.sign({ userId: USER_ID, isAdmin: false }, 'test-jwt-secret', { expiresIn: '2h' });
}

function adminToken(): string {
  return jwt.sign({ userId: ADMIN_ID, isAdmin: true }, 'test-jwt-secret', { expiresIn: '2h' });
}

function adminSubmit(quizId: string, body: unknown): request.Test {
  return request(app)
    .post(`/api/quizzes/${quizId}/submit`)
    .set('Authorization', `Bearer ${adminToken()}`)
    .send(body);
}

function authedCall(method: 'post' | 'get', url: string, body?: unknown): request.Test {
  const req = request(app)[method](url).set('Authorization', `Bearer ${token()}`);
  if (body !== undefined) {
    return req.send(body);
  }
  return req;
}

function submit(quizId: string, body: unknown): request.Test {
  return authedCall('post', `/api/quizzes/${quizId}/submit`, body);
}

function correctAnswers(): number[] {
  const order = deriveQuestionOrder(SEED, QUESTION_IDS, QUESTION_COUNT);
  return order.map((questionId) => CORRECT_OPT[questionId]);
}

function wrongAnswers(): number[] {
  const order = deriveQuestionOrder(SEED, QUESTION_IDS, QUESTION_COUNT);
  // Invert the correct option (always within bounds: every question has >= 2 options).
  return order.map((questionId) => 1 - CORRECT_OPT[questionId]);
}

beforeAll(() => {
  insertUserStmt.run(USER_ID, 'submitter@nanoquiz.app', 'Submitter', 'sub-submitter');
  insertUserStmt.run(ADMIN_ID, 'admin-submitter@nanoquiz.app', 'Admin Submitter', 'sub-admin-submitter');
});

beforeEach(() => {
  clearParticipationsStmt.run();
  clearQuestionsStmt.run();
  clearQuizzesStmt.run();
});

describe('POST /api/quizzes/:id/submit', () => {
  it('should_score_correctly_when_answers_match_derived_order', async () => {
    insertQuiz({ id: 'q-score' });
    const order = deriveQuestionOrder(SEED, QUESTION_IDS, QUESTION_COUNT);
    // Correct for the first two derived questions, wrong for the third.
    const answers = order.map(
      (questionId, i) => (i < 2 ? CORRECT_OPT[questionId] : 1 - CORRECT_OPT[questionId]),
    );

    const res = await submit('q-score', { seed: SEED, answers, elapsedMs: 12_345 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(2);
    expect(res.body.correctCount).toBe(2);
    expect(res.body.totalQuestions).toBe(QUESTION_COUNT);
    expect(res.body.durationMs).toBe(12_345);
    expect(res.body.participated).toBe(true);
  });

  it('should_score_zero_when_all_answers_are_wrong', async () => {
    insertQuiz({ id: 'q-zero' });

    const res = await submit('q-zero', { seed: SEED, answers: wrongAnswers(), elapsedMs: 1_000 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(0);
  });

  it('should_write_participation_row_when_submit_lands', async () => {
    insertQuiz({ id: 'q-row' });

    await submit('q-row', { seed: SEED, answers: correctAnswers(), elapsedMs: 4_200 });

    const row = selectParticipationRowStmt.get(USER_ID, 'q-row') as
      | { score: number; duration_ms: number }
      | undefined;
    expect(row).toBeDefined();
    expect(row!.score).toBe(QUESTION_COUNT);
    expect(row!.duration_ms).toBe(4_200);
  });

  it('should_return_stored_result_when_submit_is_repeated', async () => {
    insertQuiz({ id: 'q-idem' });
    await submit('q-idem', { seed: SEED, answers: correctAnswers(), elapsedMs: 5_000 });

    const res = await submit('q-idem', { seed: SEED, answers: wrongAnswers(), elapsedMs: 999 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(QUESTION_COUNT); // stored score, no re-scoring
    expect(res.body.durationMs).toBe(5_000);
    expect(countParticipationsStmt.get(USER_ID, 'q-idem')).toEqual({ count: 1 });
  });

  it('should_return_409_when_starting_after_submit', async () => {
    insertQuiz({ id: 'q-cycle' });

    const start = await authedCall('post', '/api/quizzes/q-cycle/start');
    expect(start.status).toBe(200);
    await submit('q-cycle', { seed: SEED, answers: correctAnswers(), elapsedMs: 3_000 });

    const secondStart = await authedCall('post', '/api/quizzes/q-cycle/start');

    expect(secondStart.status).toBe(409);
    expect(secondStart.body.error).toBe('ALREADY_PARTICIPATED');
  });

  it('should_return_400_when_seed_is_missing', async () => {
    insertQuiz({ id: 'q-live' });

    const res = await submit('q-live', { answers: correctAnswers(), elapsedMs: 1_000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_answers_length_differs_from_question_count', async () => {
    insertQuiz({ id: 'q-live' });

    const res = await submit('q-live', {
      seed: SEED,
      answers: correctAnswers().slice(0, QUESTION_COUNT - 1),
      elapsedMs: 1_000,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_answer_is_not_an_integer', async () => {
    insertQuiz({ id: 'q-live' });

    const answers = correctAnswers();
    answers[1] = 0.5;
    const res = await submit('q-live', { seed: SEED, answers, elapsedMs: 1_000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_score_zero_when_all_answers_are_timeout_sentinels', async () => {
    insertQuiz({ id: 'q-timeout' });

    const res = await submit('q-timeout', {
      seed: SEED,
      answers: [-1, -1, -1],
      elapsedMs: 45_000,
    });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(0);
    const row = selectParticipationRowStmt.get(USER_ID, 'q-timeout') as
      | { score: number; duration_ms: number }
      | undefined;
    expect(row).toBeDefined();
    expect(row!.score).toBe(0);
  });

  it('should_return_400_when_answer_is_below_negative_one', async () => {
    insertQuiz({ id: 'q-live' });

    const answers = correctAnswers();
    answers[1] = -2;
    const res = await submit('q-live', { seed: SEED, answers, elapsedMs: 1_000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_score_positionally_when_sentinels_mixed_with_correct_answers', async () => {
    insertQuiz({ id: 'q-mixed' });
    const answers = correctAnswers();
    answers[0] = -1;

    const res = await submit('q-mixed', { seed: SEED, answers, elapsedMs: 2_500 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(QUESTION_COUNT - 1);
    expect(res.body.correctCount).toBe(QUESTION_COUNT - 1);
  });

  it('should_return_400_when_answer_is_out_of_bounds', async () => {
    insertQuiz({ id: 'q-live' });

    const answers = correctAnswers();
    answers[0] = 9;
    const res = await submit('q-live', { seed: SEED, answers, elapsedMs: 1_000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_elapsed_ms_is_negative', async () => {
    insertQuiz({ id: 'q-live' });

    const res = await submit('q-live', { seed: SEED, answers: correctAnswers(), elapsedMs: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_elapsed_ms_is_not_a_number', async () => {
    insertQuiz({ id: 'q-live' });

    const res = await submit('q-live', {
      seed: SEED,
      answers: correctAnswers(),
      elapsedMs: 'fast',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_403_when_seed_is_not_valid_hex', async () => {
    insertQuiz({ id: 'q-live' });

    const res = await submit('q-live', { seed: 'zznothexzz', answers: correctAnswers(), elapsedMs: 1_000 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INVALID_SEED');
  });

  it('should_return_404_when_quiz_id_is_unknown', async () => {
    const res = await submit('no-such-quiz', { seed: SEED, answers: correctAnswers(), elapsedMs: 1_000 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('should_expose_only_safe_keys_when_submit_succeeds', async () => {
    insertQuiz({ id: 'q-keys' });

    const res = await submit('q-keys', { seed: SEED, answers: correctAnswers(), elapsedMs: 7_777 });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'correctCount',
      'durationMs',
      'participated',
      'score',
      'totalQuestions',
    ]);
    expect(JSON.stringify(res.body)).not.toContain('correct_opt');
  });

  it('should_return_200_when_quiz_end_at_has_passed', async () => {
    insertQuiz({ id: 'q-past', startOffsetMs: -2 * HOUR_MS, endOffsetMs: -HOUR_MS });

    const res = await submit('q-past', { seed: SEED, answers: correctAnswers(), elapsedMs: 2_000 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(QUESTION_COUNT);
  });

  it('should_return_401_when_authorization_header_is_missing', async () => {
    const res = await request(app)
      .post('/api/quizzes/q-live/submit')
      .send({ seed: SEED, answers: correctAnswers(), elapsedMs: 1_000 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_score_without_persisting_when_admin_submits', async () => {
    insertQuiz({ id: 'q-admin-preview' });

    const res = await adminSubmit('q-admin-preview', {
      seed: SEED,
      answers: correctAnswers(),
      elapsedMs: 8_000,
    });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(QUESTION_COUNT);
    expect(res.body.correctCount).toBe(QUESTION_COUNT);
    expect(res.body.totalQuestions).toBe(QUESTION_COUNT);
    expect(res.body.durationMs).toBe(8_000);
    expect(res.body.participated).toBe(false);
    expect(countParticipationsStmt.get(ADMIN_ID, 'q-admin-preview')).toEqual({ count: 0 });
  });

  it('should_rescore_freshly_when_admin_submits_repeatedly', async () => {
    insertQuiz({ id: 'q-admin-repeat' });

    const first = await adminSubmit('q-admin-repeat', {
      seed: SEED,
      answers: correctAnswers(),
      elapsedMs: 1_000,
    });
    const second = await adminSubmit('q-admin-repeat', {
      seed: SEED,
      answers: wrongAnswers(),
      elapsedMs: 2_000,
    });

    expect(first.status).toBe(200);
    expect(first.body.score).toBe(QUESTION_COUNT);
    expect(second.status).toBe(200);
    expect(second.body.score).toBe(0); // no idempotency: fresh re-scoring
    expect(second.body.participated).toBe(false);
    expect(countParticipationsStmt.get(ADMIN_ID, 'q-admin-repeat')).toEqual({ count: 0 });
  });

  it('should_not_appear_on_leaderboard_when_admin_submits', async () => {
    insertQuiz({ id: 'q-admin-board' });

    await adminSubmit('q-admin-board', { seed: SEED, answers: correctAnswers(), elapsedMs: 1_000 });

    const row = db
      .prepare('SELECT COUNT(*) AS total FROM participations WHERE quiz_id = ?')
      .get('q-admin-board') as { total: number };
    expect(row.total).toBe(0);
  });

  it('should_persist_when_non_admin_submits_after_admin_previewed_same_quiz', async () => {
    insertQuiz({ id: 'q-mixed-roles' });

    const admin = await adminSubmit('q-mixed-roles', {
      seed: SEED,
      answers: correctAnswers(),
      elapsedMs: 1_000,
    });
    const user = await submit('q-mixed-roles', { seed: SEED, answers: correctAnswers(), elapsedMs: 2_000 });

    expect(admin.body.participated).toBe(false);
    expect(user.status).toBe(200);
    expect(user.body.participated).toBe(true);
    expect(countParticipationsStmt.get(USER_ID, 'q-mixed-roles')).toEqual({ count: 1 });
    expect(countParticipationsStmt.get(ADMIN_ID, 'q-mixed-roles')).toEqual({ count: 0 });
  });
});
