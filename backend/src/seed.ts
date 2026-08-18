import { db, dbPath } from './db/index.js';
import { applySchema } from './db/schema.js';
import { logger } from './utils/logger.js';

applySchema(db);

interface SeedQuestion {
  id: string;
  seq: number;
  prompt: string;
  options: string[];
  correctOpt: number;
}

interface SeedQuiz {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  timeLimitSeconds: number;
  startAt: string;
  endAt: string;
  questions: SeedQuestion[];
}

function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Windows are relative to seed time so each state stays correct after a re-seed.
const seedQuizzes: SeedQuiz[] = [
  {
    id: 'quiz-live-gk',
    title: 'Live General Knowledge',
    description: 'A live general knowledge sprint — join before the window closes.',
    questionCount: 3,
    timeLimitSeconds: 15,
    startAt: isoFromNow(-HOUR_MS),
    endAt: isoFromNow(HOUR_MS),
    questions: [
      {
        id: 'quiz-live-gk-q1',
        seq: 1,
        prompt: 'What is the capital of Japan?',
        options: ['Osaka', 'Kyoto', 'Tokyo', 'Nagoya'],
        correctOpt: 2,
      },
      {
        id: 'quiz-live-gk-q2',
        seq: 2,
        prompt: 'Which planet is known as the Red Planet?',
        options: ['Venus', 'Mars', 'Jupiter', 'Mercury'],
        correctOpt: 1,
      },
      {
        id: 'quiz-live-gk-q3',
        seq: 3,
        prompt: 'How many continents are there on Earth?',
        options: ['5', '6', '7', '8'],
        correctOpt: 2,
      },
      {
        id: 'quiz-live-gk-q4',
        seq: 4,
        prompt: 'What is the largest ocean on Earth?',
        options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
        correctOpt: 3,
      },
    ],
  },
  {
    id: 'quiz-upcoming-science',
    title: 'Upcoming Science Challenge',
    description: 'A science quiz scheduled to open soon — get ready.',
    questionCount: 2,
    timeLimitSeconds: 20,
    startAt: isoFromNow(DAY_MS),
    endAt: isoFromNow(DAY_MS + 2 * HOUR_MS),
    questions: [
      {
        id: 'quiz-upcoming-science-q1',
        seq: 1,
        prompt: 'What is the chemical symbol for gold?',
        options: ['Go', 'Gd', 'Au', 'Ag'],
        correctOpt: 2,
      },
      {
        id: 'quiz-upcoming-science-q2',
        seq: 2,
        prompt: 'What gas do plants absorb from the atmosphere?',
        options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
        correctOpt: 1,
      },
      {
        id: 'quiz-upcoming-science-q3',
        seq: 3,
        prompt: 'What is the speed of light in a vacuum (approx., km/s)?',
        options: ['300,000', '150,000', '30,000', '3,000,000'],
        correctOpt: 0,
      },
    ],
  },
  {
    id: 'quiz-ended-history',
    title: 'Ended History Recap',
    description: 'A history quiz whose window has closed — check the leaderboard.',
    questionCount: 3,
    timeLimitSeconds: 15,
    startAt: isoFromNow(-2 * DAY_MS),
    endAt: isoFromNow(-DAY_MS),
    questions: [
      {
        id: 'quiz-ended-history-q1',
        seq: 1,
        prompt: 'In which year did World War II end?',
        options: ['1943', '1944', '1945', '1946'],
        correctOpt: 2,
      },
      {
        id: 'quiz-ended-history-q2',
        seq: 2,
        prompt: 'Who was the first President of the United States?',
        options: ['Thomas Jefferson', 'John Adams', 'Benjamin Franklin', 'George Washington'],
        correctOpt: 3,
      },
      {
        id: 'quiz-ended-history-q3',
        seq: 3,
        prompt: 'The Great Wall of China was primarily built to defend against which group?',
        options: ['Mongols', 'Romans', 'Persians', 'Egyptians'],
        correctOpt: 0,
      },
      {
        id: 'quiz-ended-history-q4',
        seq: 4,
        prompt: 'Which ancient civilization built the pyramids of Giza?',
        options: ['Mesopotamians', 'Egyptians', 'Greeks', 'Aztecs'],
        correctOpt: 1,
      },
    ],
  },
];

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

const upsertQuestionStmt = db.prepare(
  `INSERT INTO questions (id, quiz_id, seq, prompt, options, correct_opt)
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT (id) DO UPDATE SET
     quiz_id = excluded.quiz_id,
     seq = excluded.seq,
     prompt = excluded.prompt,
     options = excluded.options,
     correct_opt = excluded.correct_opt`,
);

const seedDemoData = db.transaction(() => {
  for (const quiz of seedQuizzes) {
    upsertQuizStmt.run(
      quiz.id,
      quiz.title,
      quiz.description,
      quiz.questionCount,
      quiz.timeLimitSeconds,
      quiz.startAt,
      quiz.endAt,
    );
    for (const question of quiz.questions) {
      upsertQuestionStmt.run(
        question.id,
        quiz.id,
        question.seq,
        question.prompt,
        JSON.stringify(question.options),
        question.correctOpt,
      );
    }
  }
});

const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };

seedDemoData();

const quizCount = db.prepare('SELECT COUNT(*) AS count FROM quizzes').get() as { count: number };
const questionCount = db
  .prepare('SELECT COUNT(*) AS count FROM questions')
  .get() as { count: number };

logger.info('Seed complete', {
  dbPath,
  users: userCount.count,
  quizzes: quizCount.count,
  questions: questionCount.count,
});
db.close();
