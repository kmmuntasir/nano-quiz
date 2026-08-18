import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';

const USER_ID = 'user-quiz-list-1';

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

interface QuizFixture {
  id: string;
  title: string;
  startOffsetMs: number;
  endOffsetMs: number;
}

const insertQuizStmt = db.prepare(
  `INSERT INTO quizzes (id, title, description, question_count, time_limit_seconds, start_at, end_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const insertParticipationStmt = db.prepare(
  `INSERT INTO participations (user_id, quiz_id, score, duration_ms)
   VALUES (?, ?, ?, ?)`,
);
const clearQuizzesStmt = db.prepare('DELETE FROM quizzes');
const clearParticipationsStmt = db.prepare('DELETE FROM participations');
const insertUserStmt = db.prepare(
  'INSERT INTO users (id, email, name, google_sub) VALUES (?, ?, ?, ?)',
);

function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function insertQuiz(fixture: QuizFixture): void {
  insertQuizStmt.run(
    fixture.id,
    fixture.title,
    `${fixture.title} description`,
    3,
    15,
    isoFromNow(fixture.startOffsetMs),
    isoFromNow(fixture.endOffsetMs),
  );
}

function authedGet(url: string): request.Test {
  const token = jwt.sign({ userId: USER_ID, isAdmin: false }, 'test-jwt-secret', {
    expiresIn: '2h',
  });
  return request(app).get(url).set('Authorization', `Bearer ${token}`);
}

beforeAll(() => {
  insertUserStmt.run(USER_ID, 'quiz-lister@nanoquiz.app', 'Quiz Lister', 'sub-quiz-lister');
});

beforeEach(() => {
  clearParticipationsStmt.run();
  clearQuizzesStmt.run();
});

describe('GET /api/quizzes', () => {
  it('should_return_401_when_authorization_header_is_missing', async () => {
    const res = await request(app).get('/api/quizzes');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('should_return_empty_array_when_no_quizzes_exist', async () => {
    const res = await authedGet('/api/quizzes');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('should_order_live_before_upcoming_before_ended_when_all_groups_exist', async () => {
    insertQuiz({ id: 'q-ended', title: 'Ended', startOffsetMs: -2 * DAY_MS, endOffsetMs: -DAY_MS });
    insertQuiz({ id: 'q-upcoming', title: 'Upcoming', startOffsetMs: DAY_MS, endOffsetMs: 2 * DAY_MS });
    insertQuiz({ id: 'q-live', title: 'Live', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });

    const res = await authedGet('/api/quizzes');

    expect(res.status).toBe(200);
    expect(res.body.map((q: { id: string }) => q.id)).toEqual([
      'q-live',
      'q-upcoming',
      'q-ended',
    ]);
  });

  it('should_order_live_quizzes_by_soonest_end_first_when_multiple_are_live', async () => {
    insertQuiz({ id: 'q-live-long', title: 'Live Long', startOffsetMs: -HOUR_MS, endOffsetMs: 2 * HOUR_MS });
    insertQuiz({ id: 'q-live-short', title: 'Live Short', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });

    const res = await authedGet('/api/quizzes');

    expect(res.status).toBe(200);
    expect(res.body.map((q: { id: string }) => q.id)).toEqual(['q-live-short', 'q-live-long']);
  });

  it('should_order_upcoming_quizzes_by_soonest_start_first_when_multiple_are_upcoming', async () => {
    insertQuiz({ id: 'q-upcoming-late', title: 'Upcoming Late', startOffsetMs: 2 * DAY_MS, endOffsetMs: 3 * DAY_MS });
    insertQuiz({ id: 'q-upcoming-soon', title: 'Upcoming Soon', startOffsetMs: HOUR_MS, endOffsetMs: 2 * HOUR_MS });

    const res = await authedGet('/api/quizzes');

    expect(res.status).toBe(200);
    expect(res.body.map((q: { id: string }) => q.id)).toEqual([
      'q-upcoming-soon',
      'q-upcoming-late',
    ]);
  });

  it('should_order_ended_quizzes_by_most_recently_ended_first_when_multiple_have_ended', async () => {
    insertQuiz({ id: 'q-ended-old', title: 'Ended Old', startOffsetMs: -3 * DAY_MS, endOffsetMs: -2 * DAY_MS });
    insertQuiz({ id: 'q-ended-recent', title: 'Ended Recent', startOffsetMs: -2 * DAY_MS, endOffsetMs: -HOUR_MS });

    const res = await authedGet('/api/quizzes');

    expect(res.status).toBe(200);
    expect(res.body.map((q: { id: string }) => q.id)).toEqual(['q-ended-recent', 'q-ended-old']);
  });

  it('should_return_can_start_false_and_participated_true_when_user_already_took_live_quiz', async () => {
    insertQuiz({ id: 'q-live-taken', title: 'Live Taken', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });
    insertParticipationStmt.run(USER_ID, 'q-live-taken', 4, 45_000);

    const res = await authedGet('/api/quizzes');

    expect(res.status).toBe(200);
    const taken = res.body.find((q: { id: string }) => q.id === 'q-live-taken');
    expect(taken.canStart).toBe(false);
    expect(taken.participated).toBe(true);
    expect(taken.userScore).toBe(4);
  });

  it('should_return_can_start_false_when_quiz_window_has_not_opened', async () => {
    insertQuiz({ id: 'q-future', title: 'Future', startOffsetMs: DAY_MS, endOffsetMs: 2 * DAY_MS });

    const res = await authedGet('/api/quizzes');

    expect(res.status).toBe(200);
    const future = res.body.find((q: { id: string }) => q.id === 'q-future');
    expect(future.canStart).toBe(false);
    expect(future.participated).toBe(false);
  });

  it('should_return_user_score_null_when_user_never_took_quiz', async () => {
    insertQuiz({ id: 'q-live-fresh', title: 'Live Fresh', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });

    const res = await authedGet('/api/quizzes');

    expect(res.status).toBe(200);
    const fresh = res.body.find((q: { id: string }) => q.id === 'q-live-fresh');
    expect(fresh.userScore).toBeNull();
    expect(fresh.participated).toBe(false);
    expect(fresh.canStart).toBe(true);
  });

  it('should_omit_correct_opt_and_question_fields_when_listing_quizzes', async () => {
    insertQuiz({ id: 'q-live-gk', title: 'Live GK', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });
    db.prepare(
      `INSERT INTO questions (id, quiz_id, seq, prompt, options, correct_opt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('q-live-gk-q1', 'q-live-gk', 1, 'Capital of Japan?', '["Osaka","Tokyo"]', 1);

    const res = await authedGet('/api/quizzes');

    expect(res.status).toBe(200);
    const item = res.body.find((q: { id: string }) => q.id === 'q-live-gk');
    expect(Object.keys(item).sort()).toEqual(
      [
        'id',
        'title',
        'description',
        'questionCount',
        'timeLimitSeconds',
        'startAt',
        'endAt',
        'canStart',
        'participated',
        'userScore',
      ].sort(),
    );
  });
});
