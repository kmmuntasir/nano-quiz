import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { deriveQuestionOrder } from '../src/utils/shuffle.js';

const USER_ID = 'user-question-1';

const HOUR_MS = 60 * 60_000;

// Fixed seeds chosen so the derived first question provably differs
// (verified against deriveQuestionOrder for the fixture question IDs).
const SEED_A = '0000000001'; // first question: q4
const SEED_B = 'abcdef1234'; // first question: q1

const QUESTION_IDS = ['q1', 'q2', 'q3', 'q4'];
const QUESTION_COUNT = 3;

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
    fixture.questionCount ?? QUESTION_COUNT,
    15,
    iso(fixture.startOffsetMs),
    iso(fixture.endOffsetMs),
  );
  for (let i = 0; i < 4; i++) {
    insertQuestionStmt.run(
      QUESTION_IDS[i],
      fixture.id,
      i + 1,
      `Prompt ${QUESTION_IDS[i]}?`,
      `["Opt A ${QUESTION_IDS[i]}","Opt B ${QUESTION_IDS[i]}"]`,
      0,
    );
  }
}

function authedGet(url: string): request.Test {
  const token = jwt.sign({ userId: USER_ID, isAdmin: false }, 'test-jwt-secret', {
    expiresIn: '2h',
  });
  return request(app).get(url).set('Authorization', `Bearer ${token}`);
}

beforeAll(() => {
  insertUserStmt.run(USER_ID, 'question-fetcher@nanoquiz.app', 'Question Fetcher', 'sub-question-fetcher');
});

beforeEach(() => {
  clearParticipationsStmt.run();
  clearQuestionsStmt.run();
  clearQuizzesStmt.run();
});

describe('GET /api/quizzes/:id/question/:seq', () => {
  it('should_return_question_payload_when_seed_and_seq_are_valid', async () => {
    insertQuiz({ id: 'q-live', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });
    const expected = deriveQuestionOrder(SEED_A, QUESTION_IDS, QUESTION_COUNT);

    const res = await authedGet(`/api/quizzes/q-live/question/1?seed=${SEED_A}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['options', 'seq', 'text', 'total']);
    expect(res.body.seq).toBe(1);
    expect(res.body.total).toBe(QUESTION_COUNT);
    expect(res.body.text).toBe(`Prompt ${expected[0]}?`);
    expect(res.body.options).toEqual([
      `Opt A ${expected[0]}`,
      `Opt B ${expected[0]}`,
    ]);
  });

  it('should_serve_every_seq_when_quiz_is_in_flight', async () => {
    insertQuiz({ id: 'q-all', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });
    const expected = deriveQuestionOrder(SEED_A, QUESTION_IDS, QUESTION_COUNT);

    for (let seq = 1; seq <= QUESTION_COUNT; seq++) {
      const res = await authedGet(`/api/quizzes/q-all/question/${seq}?seed=${SEED_A}`);
      expect(res.status).toBe(200);
      expect(res.body.seq).toBe(seq);
      expect(res.body.text).toBe(`Prompt ${expected[seq - 1]}?`);
    }
  });

  it('should_return_400_when_seed_query_param_is_missing', async () => {
    insertQuiz({ id: 'q-live', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });

    const res = await authedGet('/api/quizzes/q-live/question/1');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_seq_is_not_a_positive_integer', async () => {
    insertQuiz({ id: 'q-live', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });

    for (const seq of ['abc', '1.5']) {
      const res = await authedGet(`/api/quizzes/q-live/question/${seq}?seed=${SEED_A}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    }
  });

  it('should_return_404_when_quiz_id_is_unknown', async () => {
    const res = await authedGet(`/api/quizzes/no-such-quiz/question/1?seed=${SEED_A}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('should_return_404_when_seq_is_outside_question_count', async () => {
    insertQuiz({ id: 'q-live', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });

    for (const seq of [0, QUESTION_COUNT + 1]) {
      const res = await authedGet(`/api/quizzes/q-live/question/${seq}?seed=${SEED_A}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    }
  });

  it('should_return_403_when_seed_is_not_hex', async () => {
    insertQuiz({ id: 'q-live', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });

    const res = await authedGet('/api/quizzes/q-live/question/1?seed=zznothexzz');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('INVALID_SEED');
  });

  it('should_return_200_when_quiz_end_at_has_passed', async () => {
    insertQuiz({ id: 'q-past', startOffsetMs: -2 * HOUR_MS, endOffsetMs: -HOUR_MS });

    const res = await authedGet(`/api/quizzes/q-past/question/1?seed=${SEED_A}`);

    expect(res.status).toBe(200);
    expect(res.body.seq).toBe(1);
    expect(res.body.total).toBe(QUESTION_COUNT);
  });

  it('should_return_same_question_when_seed_is_repeated', async () => {
    insertQuiz({ id: 'q-det', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });

    const first = await authedGet(`/api/quizzes/q-det/question/1?seed=${SEED_A}`);
    const second = await authedGet(`/api/quizzes/q-det/question/1?seed=${SEED_A}`);

    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  it('should_return_different_first_question_when_seed_differs', async () => {
    insertQuiz({ id: 'q-diff', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });
    // SEED_A derives q4 first; SEED_B derives q1 first (verified fixtures).
    const withA = await authedGet(`/api/quizzes/q-diff/question/1?seed=${SEED_A}`);
    const withB = await authedGet(`/api/quizzes/q-diff/question/1?seed=${SEED_B}`);

    expect(withA.status).toBe(200);
    expect(withB.status).toBe(200);
    expect(withA.body.text).toBe('Prompt q4?');
    expect(withB.body.text).toBe('Prompt q1?');
    expect(withA.body.text).not.toBe(withB.body.text);
  });

  it('should_return_401_when_authorization_header_is_missing', async () => {
    const res = await request(app).get(`/api/quizzes/q-live/question/1?seed=${SEED_A}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });
});
