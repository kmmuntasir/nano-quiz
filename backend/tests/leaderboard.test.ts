import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';

const HOUR_MS = 60 * 60_000;

interface FixtureUser {
  id: string;
  name: string;
  score: number;
  durationMs: number;
}

// Varied scores/durations: ties on score broken by duration, mixed order on insert.
const FIXTURE_USERS: FixtureUser[] = [
  { id: 'lb-1', name: 'Alice', score: 3, durationMs: 9_000 },
  { id: 'lb-2', name: 'Bob', score: 5, durationMs: 8_000 },
  { id: 'lb-3', name: 'Carol', score: 5, durationMs: 4_000 },
  { id: 'lb-4', name: 'Dave', score: 4, durationMs: 1_000 },
  { id: 'lb-5', name: 'Eve', score: 0, durationMs: 500 },
];

const insertUserStmt = db.prepare(
  'INSERT INTO users (id, email, name, google_sub) VALUES (?, ?, ?, ?)',
);
const insertQuizStmt = db.prepare(
  `INSERT INTO quizzes (id, title, description, question_count, time_limit_seconds, start_at, end_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const insertParticipationStmt = db.prepare(
  'INSERT INTO participations (user_id, quiz_id, score, duration_ms) VALUES (?, ?, ?, ?)',
);
const clearQuizzesStmt = db.prepare('DELETE FROM quizzes');
const clearParticipationsStmt = db.prepare('DELETE FROM participations');

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const QUIZ_ID = 'q-board';

function insertQuizWithBoard(): void {
  insertQuizStmt.run(
    QUIZ_ID,
    'Board quiz',
    'board description',
    5,
    15,
    iso(-HOUR_MS),
    iso(HOUR_MS),
  );
  for (const user of FIXTURE_USERS) {
    insertParticipationStmt.run(user.id, QUIZ_ID, user.score, user.durationMs);
  }
}

function get(quizId: string, query?: string): request.Test {
  const token = jwt.sign({ userId: 'lb-viewer', isAdmin: false }, 'test-jwt-secret', {
    expiresIn: '2h',
  });
  const url = query === undefined ? `/api/quizzes/${quizId}/leaderboard` : `/api/quizzes/${quizId}/leaderboard?${query}`;
  return request(app).get(url).set('Authorization', `Bearer ${token}`);
}

// Expected order: score DESC, duration ASC — Carol, Bob, Dave, Alice, Eve.
const EXPECTED_NAMES = ['Carol', 'Bob', 'Dave', 'Alice', 'Eve'];

beforeAll(() => {
  insertUserStmt.run('lb-viewer', 'viewer@nanoquiz.app', 'Viewer', 'sub-viewer');
  for (const user of FIXTURE_USERS) {
    insertUserStmt.run(user.id, `${user.id}@nanoquiz.app`, user.name, `sub-${user.id}`);
  }
});

beforeEach(() => {
  clearParticipationsStmt.run();
  clearQuizzesStmt.run();
});

describe('GET /api/quizzes/:id/leaderboard', () => {
  it('should_order_entries_when_scores_and_durations_vary', async () => {
    insertQuizWithBoard();

    const res = await get(QUIZ_ID);

    expect(res.status).toBe(200);
    expect(res.body.entries.map((e: { name: string }) => e.name)).toEqual(EXPECTED_NAMES);
  });

  it('should_rank_sequentially_when_entries_are_returned', async () => {
    insertQuizWithBoard();

    const res = await get(QUIZ_ID);

    expect(res.body.entries.map((e: { rank: number }) => e.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should_continue_rank_across_page_two_when_paging', async () => {
    insertQuizWithBoard();

    const res = await get(QUIZ_ID, 'page=2&pageSize=3');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.total).toBe(5);
    expect(res.body.entries.map((e: { name: string }) => e.name)).toEqual(['Alice', 'Eve']);
    expect(res.body.entries.map((e: { rank: number }) => e.rank)).toEqual([4, 5]);
  });

  it('should_use_defaults_when_params_are_absent', async () => {
    insertQuizWithBoard();

    const res = await get(QUIZ_ID);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
  });

  it('should_cap_page_size_when_it_exceeds_the_maximum', async () => {
    insertQuizWithBoard();

    const res = await get(QUIZ_ID, 'pageSize=500');

    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(100);
    expect(res.body.entries).toHaveLength(5);
  });

  it('should_return_empty_entries_when_quiz_has_no_participations', async () => {
    insertQuizStmt.run(QUIZ_ID, 'Empty quiz', 'empty', 5, 15, iso(-HOUR_MS), iso(HOUR_MS));

    const res = await get(QUIZ_ID);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.entries).toEqual([]);
  });

  it('should_not_list_user_when_attempt_was_abandoned_without_submit', async () => {
    insertQuizWithBoard();
    // The board fixture has no question bank; start needs one to mint a seed.
    const insertQuestionStmt = db.prepare(
      `INSERT INTO questions (id, quiz_id, seq, prompt, options, correct_opt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (let seq = 1; seq <= 5; seq++) {
      insertQuestionStmt.run(`lb-q${seq}`, QUIZ_ID, seq, `Prompt ${seq}?`, '["A","B"]', 0);
    }
    const token = jwt.sign({ userId: 'lb-viewer', isAdmin: false }, 'test-jwt-secret', {
      expiresIn: '2h',
    });

    const start = await request(app)
      .post(`/api/quizzes/${QUIZ_ID}/start`)
      .set('Authorization', `Bearer ${token}`);
    expect(start.status).toBe(200);

    const question = await request(app)
      .get(`/api/quizzes/${QUIZ_ID}/question/1`)
      .query({ seed: start.body.seed as string })
      .set('Authorization', `Bearer ${token}`);
    expect(question.status).toBe(200);

    const res = await get(QUIZ_ID);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(FIXTURE_USERS.length);
    expect(
      res.body.entries.some((e: { name: string }) => e.name === 'Viewer'),
    ).toBe(false);
  });

  it('should_return_404_when_quiz_id_is_unknown', async () => {
    const res = await get('no-such-quiz');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('should_return_400_when_page_is_not_an_integer', async () => {
    insertQuizWithBoard();

    const res = await get(QUIZ_ID, 'page=abc');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_page_is_zero', async () => {
    insertQuizWithBoard();

    const res = await get(QUIZ_ID, 'page=0');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_400_when_page_size_is_negative', async () => {
    insertQuizWithBoard();

    const res = await get(QUIZ_ID, 'pageSize=-1');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('should_return_401_when_authorization_header_is_missing', async () => {
    const res = await request(app).get(`/api/quizzes/${QUIZ_ID}/leaderboard`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_expose_only_safe_keys_when_leaderboard_is_returned', async () => {
    insertQuizWithBoard();

    const res = await get(QUIZ_ID);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'entries',
      'page',
      'pageSize',
      'quizId',
      'total',
    ]);
    expect(Object.keys(res.body.entries[0]).sort()).toEqual(['durationMs', 'name', 'rank', 'score']);
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('email');
    expect(serialized).not.toContain('correct_opt');
  });
});
