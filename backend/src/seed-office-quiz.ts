import fs from 'node:fs';
import path from 'node:path';

import { db, dbPath } from './db/index.js';
import { applySchema } from './db/schema.js';
import { logger } from './utils/logger.js';

applySchema(db);

const QUIZ_ID = 'office-quiz';
const QUIZ_TITLE = 'The Office Quiz';
const QUIZ_DESCRIPTION =
  '20 company FAQ + 30 general knowledge questions — 10 random per player, 40/60 mix.';
const QUIZ_QUESTION_COUNT = 10;
const QUIZ_TIME_LIMIT_SECONDS = 15;
const QUIZ_START_AT = '2026-08-20T11:00:00.000Z';
const QUIZ_END_AT = '2026-08-23T05:00:00.000Z';

const INPUT_PATH = path.join(import.meta.dirname, '..', 'data', 'office-quiz.json');

interface OfficeQuizQuestion {
  num: number;
  category: 'faq' | 'general';
  text: string;
  options: string[];
  correctOpt: number;
}

interface OfficeQuizInput {
  questions: OfficeQuizQuestion[];
}

interface CountRow {
  count: number;
}

function loadQuestions(): OfficeQuizQuestion[] {
  const raw = fs.readFileSync(INPUT_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as OfficeQuizInput;
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error(`No questions found in ${INPUT_PATH}`);
  }
  return parsed.questions;
}

const questions = loadQuestions();

const participationCount = db
  .prepare<[string], CountRow>('SELECT COUNT(*) AS count FROM participations WHERE quiz_id = ?')
  .get(QUIZ_ID)!.count;

if (participationCount > 0) {
  logger.error(
    'Refusing to replace office-quiz question bank: participations exist for this quiz',
    { quizId: QUIZ_ID, participationCount },
  );
  db.close();
  process.exitCode = 1;
} else {
  const upsertQuizStmt = db.prepare(
    `INSERT INTO quizzes (id, title, description, question_count, time_limit_seconds, start_at, end_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       question_count = excluded.question_count,
       time_limit_seconds = excluded.time_limit_seconds,
       start_at = excluded.start_at,
       end_at = excluded.end_at,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  );

  const deleteQuestionsStmt = db.prepare('DELETE FROM questions WHERE quiz_id = ?');

  const insertQuestionStmt = db.prepare(
    `INSERT INTO questions (id, quiz_id, seq, prompt, options, correct_opt, category)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const seedOfficeQuiz = db.transaction(() => {
    upsertQuizStmt.run(
      QUIZ_ID,
      QUIZ_TITLE,
      QUIZ_DESCRIPTION,
      QUIZ_QUESTION_COUNT,
      QUIZ_TIME_LIMIT_SECONDS,
      QUIZ_START_AT,
      QUIZ_END_AT,
    );

    deleteQuestionsStmt.run(QUIZ_ID);

    for (const question of questions) {
      insertQuestionStmt.run(
        `${QUIZ_ID}-q${question.num}`,
        QUIZ_ID,
        question.num,
        question.text,
        JSON.stringify(question.options),
        question.correctOpt,
        question.category,
      );
    }
  });

  seedOfficeQuiz();

  const faqCount = questions.filter((question) => question.category === 'faq').length;
  const generalCount = questions.length - faqCount;

  logger.info('Office quiz seed complete', {
    dbPath,
    quizId: QUIZ_ID,
    totalQuestions: questions.length,
    faqQuestions: faqCount,
    generalQuestions: generalCount,
    questionCount: QUIZ_QUESTION_COUNT,
    timeLimitSeconds: QUIZ_TIME_LIMIT_SECONDS,
    window: { startAt: QUIZ_START_AT, endAt: QUIZ_END_AT },
  });
  db.close();
}
