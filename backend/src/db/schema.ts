import type Database from 'better-sqlite3';

export const USERS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  google_sub TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

export function applySchema(db: Database.Database): void {
  db.exec(USERS_TABLE_DDL);
}
