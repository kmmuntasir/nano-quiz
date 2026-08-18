import type Database from 'better-sqlite3';

export const USERS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  google_sub TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export const QUIZZES_TABLE_DDL = `CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  question_count INTEGER NOT NULL,
  time_limit_seconds INTEGER NOT NULL DEFAULT 15,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);`;

export const QUESTIONS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_opt INTEGER NOT NULL,
  UNIQUE (quiz_id, seq)
);`;

export const PARTICIPATIONS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS participations (
  user_id TEXT NOT NULL REFERENCES users(id),
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  score INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, quiz_id)
);`;

export const QUESTIONS_QUIZ_ID_INDEX_DDL =
  'CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);';

export const PARTICIPATIONS_QUIZ_ID_INDEX_DDL =
  'CREATE INDEX IF NOT EXISTS idx_participations_quiz_id ON participations(quiz_id);';

export function applySchema(db: Database.Database): void {
  db.exec(USERS_TABLE_DDL);
  db.exec(QUIZZES_TABLE_DDL);
  db.exec(QUESTIONS_TABLE_DDL);
  db.exec(PARTICIPATIONS_TABLE_DDL);
  db.exec(QUESTIONS_QUIZ_ID_INDEX_DDL);
  db.exec(PARTICIPATIONS_QUIZ_ID_INDEX_DDL);
}
