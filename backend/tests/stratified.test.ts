import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { deriveQuestionOrder, deriveStratifiedOrder } from '../src/utils/shuffle.js';

const USER_ID = 'user-strat-1';

const HOUR_MS = 60 * 60_000;

const SEED_A = '0000000001';
const SEED_B = 'abcdef1234';

const QUESTION_COUNT = 10;
const FAQ_QUOTA = 4;

// 4 faq + 6 general bank; every id encodes its category.
const FAQ_IDS = ['faq-1', 'faq-2', 'faq-3', 'faq-4'];
const GENERAL_IDS = ['gen-1', 'gen-2', 'gen-3', 'gen-4', 'gen-5', 'gen-6'];
const ALL_IDS = [...FAQ_IDS, ...GENERAL_IDS];

const insertUserStmt = db.prepare(
  'INSERT INTO users (id, email, name, google_sub) VALUES (?, ?, ?, ?)',
);
const insertQuizStmt = db.prepare(
  `INSERT INTO quizzes (id, title, description, question_count, time_limit_seconds, start_at, end_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const insertQuestionStmt = db.prepare(
  `INSERT INTO questions (id, quiz_id, seq, prompt, options, correct_opt, category)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const clearQuizzesStmt = db.prepare('DELETE FROM quizzes');
const clearQuestionsStmt = db.prepare('DELETE FROM questions');
const clearParticipationsStmt = db.prepare('DELETE FROM participations');

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function insertMixedQuiz(id: string): void {
  insertQuizStmt.run(id, `Quiz ${id}`, `${id} description`, QUESTION_COUNT, 15, iso(-HOUR_MS), iso(HOUR_MS));
  ALL_IDS.forEach((questionId, index) => {
    insertQuestionStmt.run(
      questionId,
      id,
      index + 1,
      `Prompt ${questionId}?`,
      '["A","B"]',
      1, // correct_opt = 1 for every question: scoring is purely order-sensitive
      questionId.startsWith('faq-') ? 'faq' : 'general',
    );
  });
}

// Single-category bank of the same total size — exercises the plain fallback.
function insertSingleCategoryQuiz(id: string): void {
  insertQuizStmt.run(id, `Quiz ${id}`, `${id} description`, QUESTION_COUNT, 15, iso(-HOUR_MS), iso(HOUR_MS));
  ALL_IDS.forEach((questionId, index) => {
    insertQuestionStmt.run(
      questionId,
      id,
      index + 1,
      `Prompt ${questionId}?`,
      '["A","B"]',
      1,
      'general',
    );
  });
}

function token(): string {
  return jwt.sign({ userId: USER_ID, isAdmin: false }, 'test-jwt-secret', { expiresIn: '2h' });
}

function authedGet(url: string): request.Test {
  return request(app).get(url).set('Authorization', `Bearer ${token()}`);
}

beforeAll(() => {
  insertUserStmt.run(USER_ID, 'strat@nanoquiz.app', 'Strat Tester', 'sub-strat');
});

beforeEach(() => {
  clearParticipationsStmt.run();
  clearQuestionsStmt.run();
  clearQuizzesStmt.run();
});

describe('stratified question selection', () => {
  it('should_serve_4_faq_and_6_general_when_bank_is_mixed', async () => {
    insertMixedQuiz('q-mixed');
    const expected = deriveStratifiedOrder(SEED_A, FAQ_IDS, GENERAL_IDS, QUESTION_COUNT, FAQ_QUOTA);

    const served: string[] = [];
    for (let seq = 1; seq <= QUESTION_COUNT; seq++) {
      const res = await authedGet(`/api/quizzes/q-mixed/question/${seq}?seed=${SEED_A}`);
      expect(res.status).toBe(200);
      served.push(res.body.text.replace(/^Prompt /, '').replace(/\?$/, ''));
    }

    expect(served).toEqual(expected);
    expect(served.filter((id) => id.startsWith('faq-'))).toHaveLength(FAQ_QUOTA);
    expect(served.filter((id) => id.startsWith('gen-'))).toHaveLength(QUESTION_COUNT - FAQ_QUOTA);
  });

  it('should_return_same_set_when_seed_is_repeated', async () => {
    insertMixedQuiz('q-det');

    const fetchOrder = async (seed: string): Promise<string[]> => {
      const order: string[] = [];
      for (let seq = 1; seq <= QUESTION_COUNT; seq++) {
        const res = await authedGet(`/api/quizzes/q-det/question/${seq}?seed=${seed}`);
        order.push(res.body.text.replace(/^Prompt /, '').replace(/\?$/, ''));
      }
      return order;
    };

    const first = await fetchOrder(SEED_A);
    const second = await fetchOrder(SEED_A);
    expect(second).toEqual(first);
  });

  it('should_return_different_set_when_seed_differs', async () => {
    insertMixedQuiz('q-diff');
    // Exact-quota pools force the same set for every seed — enlarge both pools
    // so the per-seed subset selection itself can differ.
    ['faq-5', 'faq-6', 'gen-7', 'gen-8'].forEach((questionId) => {
      insertQuestionStmt.run(
        questionId,
        'q-diff',
        ALL_IDS.length + Number(questionId.split('-')[1]),
        `Prompt ${questionId}?`,
        '["A","B"]',
        1,
        questionId.startsWith('faq-') ? 'faq' : 'general',
      );
    });

    const fetchSet = async (seed: string): Promise<string[]> => {
      const ids: string[] = [];
      for (let seq = 1; seq <= QUESTION_COUNT; seq++) {
        const res = await authedGet(`/api/quizzes/q-diff/question/${seq}?seed=${seed}`);
        ids.push(res.body.text.replace(/^Prompt /, '').replace(/\?$/, ''));
      }
      return [...new Set(ids)].sort();
    };

    const withA = await fetchSet(SEED_A);
    const withB = await fetchSet(SEED_B);
    expect(withA).not.toEqual(withB);
  });

  it('should_fall_back_to_plain_order_when_pool_is_too_small', async () => {
    insertMixedQuiz('q-small-pool');
    // Shrink the faq pool below the quota (4): stratification becomes impossible.
    db.prepare("DELETE FROM questions WHERE id = 'faq-1'").run();
    const expected = deriveQuestionOrder(SEED_A, ALL_IDS.filter((id) => id !== 'faq-1'), QUESTION_COUNT);

    const res = await authedGet(`/api/quizzes/q-small-pool/question/1?seed=${SEED_A}`);

    expect(res.status).toBe(200);
    expect(res.body.text).toBe(`Prompt ${expected[0]}?`);
  });

  it('should_use_plain_order_when_bank_is_single_category', async () => {
    insertSingleCategoryQuiz('q-single');
    const expected = deriveQuestionOrder(SEED_A, ALL_IDS, QUESTION_COUNT);

    const res = await authedGet(`/api/quizzes/q-single/question/1?seed=${SEED_A}`);

    expect(res.status).toBe(200);
    expect(res.body.text).toBe(`Prompt ${expected[0]}?`);
  });

  it('should_score_against_same_stratified_order_when_submitting', async () => {
    insertMixedQuiz('q-submit');
    const order = deriveStratifiedOrder(SEED_A, FAQ_IDS, GENERAL_IDS, QUESTION_COUNT, FAQ_QUOTA);
    const answers = order.map((_, i) => (i % 2 === 0 ? 1 : 0)); // correct on even positions

    const res = await request(app)
      .post('/api/quizzes/q-submit/submit')
      .set('Authorization', `Bearer ${token()}`)
      .send({ seed: SEED_A, answers, elapsedMs: 10_000 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(5);
    expect(res.body.totalQuestions).toBe(QUESTION_COUNT);
  });
});
