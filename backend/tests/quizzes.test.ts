import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { deriveQuestionOrder } from '../src/utils/shuffle.js';

const USER_ID = 'user-quiz-list-1';
const ADMIN_ID = 'admin-quiz-list-1';

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
const insertQuestionStmt = db.prepare(
  `INSERT INTO questions (id, quiz_id, seq, prompt, options, correct_opt)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const clearQuestionsStmt = db.prepare('DELETE FROM questions');
const closeQuizWindowStmt = db.prepare('UPDATE quizzes SET end_at = ? WHERE id = ?');
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

function adminGet(url: string): request.Test {
  const token = jwt.sign({ userId: ADMIN_ID, isAdmin: true }, 'test-jwt-secret', {
    expiresIn: '2h',
  });
  return request(app).get(url).set('Authorization', `Bearer ${token}`);
}

beforeAll(() => {
  insertUserStmt.run(USER_ID, 'quiz-lister@nanoquiz.app', 'Quiz Lister', 'sub-quiz-lister');
  insertUserStmt.run(ADMIN_ID, 'admin-lister@nanoquiz.app', 'Admin Lister', 'sub-admin-lister');
});

beforeEach(() => {
  clearParticipationsStmt.run();
  clearQuestionsStmt.run();
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

  it('should_return_can_start_true_for_ended_and_upcoming_when_admin_lists', async () => {
    // insertQuizWithBank has fixed question IDs (single-use), so build the banks inline.
    insertQuiz({ id: 'q-admin-ended', title: 'Admin Ended', startOffsetMs: -2 * HOUR_MS, endOffsetMs: -HOUR_MS });
    insertQuiz({ id: 'q-admin-upcoming', title: 'Admin Upcoming', startOffsetMs: HOUR_MS, endOffsetMs: 2 * HOUR_MS });
    for (const quizId of ['q-admin-ended', 'q-admin-upcoming']) {
      insertQuestionStmt.run(`${quizId}-q1`, quizId, 1, 'Prompt 1?', '["A","B"]', 0);
      insertQuestionStmt.run(`${quizId}-q2`, quizId, 2, 'Prompt 2?', '["A","B"]', 1);
      insertQuestionStmt.run(`${quizId}-q3`, quizId, 3, 'Prompt 3?', '["A","B","C"]', 2);
    }

    const res = await adminGet('/api/quizzes');

    expect(res.status).toBe(200);
    const ended = res.body.find((q: { id: string }) => q.id === 'q-admin-ended');
    const upcoming = res.body.find((q: { id: string }) => q.id === 'q-admin-upcoming');
    expect(ended.canStart).toBe(true);
    expect(upcoming.canStart).toBe(true);
  });

  it('should_return_can_start_false_when_admin_lists_quiz_with_insufficient_bank', async () => {
    // insertQuiz leaves the bank empty while questionCount is 3.
    insertQuiz({ id: 'q-admin-thin', title: 'Admin Thin', startOffsetMs: -HOUR_MS, endOffsetMs: HOUR_MS });

    const res = await adminGet('/api/quizzes');

    expect(res.status).toBe(200);
    const thin = res.body.find((q: { id: string }) => q.id === 'q-admin-thin');
    expect(thin.canStart).toBe(false);
  });

  it('should_return_can_start_false_for_ended_quiz_when_non_admin_lists', async () => {
    insertQuizWithBank({ id: 'q-user-ended', startOffsetMs: -2 * HOUR_MS, endOffsetMs: -HOUR_MS });

    const res = await authedGet('/api/quizzes');

    expect(res.status).toBe(200);
    const ended = res.body.find((q: { id: string }) => q.id === 'q-user-ended');
    expect(ended.canStart).toBe(false);
  });
});

// Full-cycle participation lock tests: real start → question fetch → submit → list.
// No direct insertParticipationStmt usage — the lock is produced by the API itself.
const FULL_CYCLE_QUESTION_IDS = ['fc-q1', 'fc-q2', 'fc-q3', 'fc-q4'];
const FULL_CYCLE_QUESTION_COUNT = 3;
const FULL_CYCLE_CORRECT_OPT: Record<string, number> = {
  'fc-q1': 0,
  'fc-q2': 1,
  'fc-q3': 0,
  'fc-q4': 1,
};
const FULL_CYCLE_OPTIONS_JSON: Record<string, string> = {
  'fc-q1': '["FC1 A","FC1 B"]',
  'fc-q2': '["FC2 A","FC2 B"]',
  'fc-q3': '["FC3 A","FC3 B","FC3 C"]',
  'fc-q4': '["FC4 A","FC4 B"]',
};

interface FullCycleQuizFixture {
  id: string;
  startOffsetMs?: number;
  endOffsetMs?: number;
}

function insertQuizWithBank(fixture: FullCycleQuizFixture): void {
  insertQuizStmt.run(
    fixture.id,
    `Quiz ${fixture.id}`,
    `${fixture.id} description`,
    FULL_CYCLE_QUESTION_COUNT,
    15,
    isoFromNow(fixture.startOffsetMs ?? -HOUR_MS),
    isoFromNow(fixture.endOffsetMs ?? HOUR_MS),
  );
  FULL_CYCLE_QUESTION_IDS.forEach((questionId, index) => {
    insertQuestionStmt.run(
      questionId,
      fixture.id,
      index + 1,
      `Prompt ${questionId}?`,
      FULL_CYCLE_OPTIONS_JSON[questionId],
      FULL_CYCLE_CORRECT_OPT[questionId],
    );
  });
}

function authedPost(url: string, body?: unknown): request.Test {
  const token = jwt.sign({ userId: USER_ID, isAdmin: false }, 'test-jwt-secret', {
    expiresIn: '2h',
  });
  const req = request(app).post(url).set('Authorization', `Bearer ${token}`);
  return body !== undefined ? req.send(body) : req;
}

function authedQuestion(quizId: string, seed: string): request.Test {
  const token = jwt.sign({ userId: USER_ID, isAdmin: false }, 'test-jwt-secret', {
    expiresIn: '2h',
  });
  return request(app)
    .get(`/api/quizzes/${quizId}/question/1`)
    .query({ seed })
    .set('Authorization', `Bearer ${token}`);
}

// Mixed answers derived from the actual start seed: first two correct, last wrong.
function mixedAnswers(seed: string): number[] {
  const order = deriveQuestionOrder(seed, FULL_CYCLE_QUESTION_IDS, FULL_CYCLE_QUESTION_COUNT);
  return order.map(
    (questionId, i) =>
      i < 2 ? FULL_CYCLE_CORRECT_OPT[questionId] : 1 - FULL_CYCLE_CORRECT_OPT[questionId],
  );
}

async function completeFullCycle(quizId: string): Promise<{ correctCount: number }> {
  const start = await authedPost(`/api/quizzes/${quizId}/start`);
  expect(start.status).toBe(200);

  const question = await authedQuestion(quizId, start.body.seed as string);
  expect(question.status).toBe(200);

  const submit = await authedPost(`/api/quizzes/${quizId}/submit`, {
    seed: start.body.seed,
    answers: mixedAnswers(start.body.seed as string),
    elapsedMs: 21_000,
  });
  expect(submit.status).toBe(200);
  return submit.body as { correctCount: number };
}

describe('full-cycle participation lock', () => {
  it('should_reflect_participation_in_quiz_list_when_full_cycle_completes', async () => {
    insertQuizWithBank({ id: 'q-cycle-lock' });

    const { correctCount } = await completeFullCycle('q-cycle-lock');

    const res = await authedGet('/api/quizzes');

    expect(res.status).toBe(200);
    const item = res.body.find((q: { id: string }) => q.id === 'q-cycle-lock');
    expect(item.participated).toBe(true);
    expect(item.canStart).toBe(false);
    expect(item.userScore).toBe(correctCount);
  });

  it('should_return_409_when_starting_again_after_full_cycle', async () => {
    insertQuizWithBank({ id: 'q-cycle-409' });
    await completeFullCycle('q-cycle-409');

    const res = await authedPost('/api/quizzes/q-cycle-409/start');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_PARTICIPATED');
    expect(res.body.message).toBeTypeOf('string');
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it('should_return_403_when_window_closed_even_if_participated', async () => {
    // Documents the start handler's guard order: the active-window check
    // (403 QUIZ_NOT_ACTIVE) precedes the participation check (409). The cycle
    // runs while live, then the window is closed before the second start.
    insertQuizWithBank({ id: 'q-cycle-window' });
    await completeFullCycle('q-cycle-window');
    closeQuizWindowStmt.run(isoFromNow(-HOUR_MS), 'q-cycle-window');

    const res = await authedPost('/api/quizzes/q-cycle-window/start');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('QUIZ_NOT_ACTIVE');
  });

  it('should_omit_answer_keys_when_starting_and_fetching_question_in_full_cycle', async () => {
    insertQuizWithBank({ id: 'q-cycle-keys' });

    const start = await authedPost('/api/quizzes/q-cycle-keys/start');
    expect(start.status).toBe(200);
    expect(Object.keys(start.body).sort()).toEqual(
      ['questionCount', 'quizId', 'seed', 'timeLimitSeconds'].sort(),
    );
    expect(JSON.stringify(start.body)).not.toContain('correct_opt');

    const question = await authedQuestion('q-cycle-keys', start.body.seed as string);
    expect(question.status).toBe(200);
    expect(Object.keys(question.body).sort()).toEqual(['options', 'seq', 'text', 'total'].sort());
    expect(JSON.stringify(question.body)).not.toContain('correct_opt');
  });
});
