import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';

const ADMIN_ID = 'admin-lb-1';
const PLAYER_ID = 'player-lb-1';

const HOUR_MS = 60 * 60_000;

interface FixtureUser {
  id: string;
  name: string;
  score: number;
  durationMs: number;
}

const FIXTURE_USERS: FixtureUser[] = [
  { id: 'alb-1', name: 'Alice', score: 3, durationMs: 9_000 },
  { id: 'alb-2', name: 'Bob', score: 5, durationMs: 8_000 },
  { id: 'alb-3', name: 'Carol', score: 5, durationMs: 4_000 },
  { id: 'alb-4', name: 'Dave', score: 4, durationMs: 1_000 },
  { id: 'alb-5', name: 'Eve', score: 0, durationMs: 500 },
];

const insertUserStmt = db.prepare(
  'INSERT INTO users (id, email, name, google_sub) VALUES (?, ?, ?, ?)',
);
const insertQuizStmt = db.prepare(
  `INSERT INTO quizzes (id, title, description, question_count, time_limit_seconds, start_at, end_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const insertParticipationStmt = db.prepare(
  `INSERT INTO participations (user_id, quiz_id, score, duration_ms)
   VALUES (?, ?, ?, ?)`,
);
const clearParticipationsStmt = db.prepare('DELETE FROM participations');
const clearQuizzesStmt = db.prepare('DELETE FROM quizzes');

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const QUIZ_ID = 'alb-board';

function insertQuizWithBoard(): void {
  insertQuizStmt.run(QUIZ_ID, 'Admin board quiz', 'board description', 5, 15, iso(-HOUR_MS), iso(HOUR_MS));
  for (const user of FIXTURE_USERS) {
    insertParticipationStmt.run(user.id, QUIZ_ID, user.score, user.durationMs);
  }
}

function adminGet(query?: string): request.Test {
  const token = jwt.sign({ userId: ADMIN_ID, isAdmin: true }, 'test-jwt-secret', {
    expiresIn: '2h',
  });
  const url =
    query === undefined
      ? `/api/admin/quizzes/${QUIZ_ID}/leaderboard`
      : `/api/admin/quizzes/${QUIZ_ID}/leaderboard?${query}`;
  return request(app).get(url).set('Authorization', `Bearer ${token}`);
}

// Expected order: score DESC, duration ASC — Carol, Bob, Dave, Alice, Eve.
const EXPECTED_NAMES = ['Carol', 'Bob', 'Dave', 'Alice', 'Eve'];

beforeAll(() => {
  insertUserStmt.run(ADMIN_ID, 'admin-lb@nanoquiz.app', 'Admin Lb', 'sub-admin-lb');
  insertUserStmt.run(PLAYER_ID, 'player-lb@nanoquiz.app', 'Player Lb', 'sub-player-lb');
  for (const user of FIXTURE_USERS) {
    insertUserStmt.run(user.id, `${user.id}@nanoquiz.app`, user.name, `sub-${user.id}`);
  }
});

beforeEach(() => {
  clearParticipationsStmt.run();
  clearQuizzesStmt.run();
});

describe('GET /api/admin/quizzes/:id/leaderboard', () => {
  it('should_return_401_when_authorization_header_is_missing', async () => {
    insertQuizWithBoard();

    const res = await request(app).get(`/api/admin/quizzes/${QUIZ_ID}/leaderboard`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_return_403_when_token_has_is_admin_false', async () => {
    insertQuizWithBoard();

    const token = jwt.sign({ userId: PLAYER_ID, isAdmin: false }, 'test-jwt-secret', {
      expiresIn: '2h',
    });
    const res = await request(app)
      .get(`/api/admin/quizzes/${QUIZ_ID}/leaderboard`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'FORBIDDEN', message: 'Admin access required.' });
  });

  it('should_return_404_when_quiz_is_unknown', async () => {
    const token = jwt.sign({ userId: ADMIN_ID, isAdmin: true }, 'test-jwt-secret', {
      expiresIn: '2h',
    });
    const res = await request(app)
      .get('/api/admin/quizzes/no-such-quiz/leaderboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  it('should_match_public_leaderboard_shape_when_board_is_seeded', async () => {
    insertQuizWithBoard();

    const adminRes = await adminGet();
    const playerToken = jwt.sign({ userId: PLAYER_ID, isAdmin: false }, 'test-jwt-secret', {
      expiresIn: '2h',
    });
    const publicRes = await request(app)
      .get(`/api/quizzes/${QUIZ_ID}/leaderboard`)
      .set('Authorization', `Bearer ${playerToken}`);

    expect(adminRes.status).toBe(200);
    expect(publicRes.status).toBe(200);
    expect(Object.keys(adminRes.body).sort()).toEqual(['entries', 'page', 'pageSize', 'quizId', 'total']);
    expect(adminRes.body).toEqual(publicRes.body);
  });

  it('should_order_entries_by_score_then_duration', async () => {
    insertQuizWithBoard();

    const res = await adminGet();

    expect(res.status).toBe(200);
    expect(res.body.entries.map((e: { name: string }) => e.name)).toEqual(EXPECTED_NAMES);
    expect(res.body.entries.map((e: { rank: number }) => e.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
  });

  it('should_continue_rank_across_page_two_when_paging', async () => {
    insertQuizWithBoard();

    const res = await adminGet('page=2&pageSize=3');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(3);
    expect(res.body.total).toBe(5);
    expect(res.body.entries.map((e: { name: string }) => e.name)).toEqual(['Alice', 'Eve']);
    expect(res.body.entries.map((e: { rank: number }) => e.rank)).toEqual([4, 5]);
  });

  it('should_cap_page_size_when_it_exceeds_the_maximum', async () => {
    insertQuizWithBoard();

    const res = await adminGet('pageSize=500');

    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(100);
    expect(res.body.entries).toHaveLength(5);
  });
});
