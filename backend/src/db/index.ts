import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { applySchema } from './schema.js';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  googleSub: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewUser {
  id: string;
  email: string;
  name: string;
  googleSub: string;
}

// Default DB_PATH is repo-root-relative ('backend/data/nanoquiz.sqlite'); resolve
// against the repo root so npm scripts work regardless of the process cwd.
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

function resolveDbPath(dbPath: string): string {
  if (dbPath === ':memory:' || path.isAbsolute(dbPath)) {
    return dbPath;
  }
  return path.resolve(REPO_ROOT, dbPath);
}

export const dbPath = resolveDbPath(config.dbPath);

function ensureDbFile(targetPath: string): void {
  if (targetPath === ':memory:' || fs.existsSync(targetPath)) {
    return;
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.closeSync(fs.openSync(targetPath, 'a'));
}

ensureDbFile(dbPath);

export const db = new Database(dbPath);

// Statements below require the schema to exist at prepare time (SQLite resolves
// table names eagerly), so apply it here as well as in the idempotent seed.
applySchema(db);

const USER_COLUMNS =
  'id, email, name, google_sub AS googleSub, created_at AS createdAt, updated_at AS updatedAt';

const selectUserByEmailStmt = db.prepare<[string], UserRow>(
  `SELECT ${USER_COLUMNS} FROM users WHERE email = ?`,
);
const selectUserByIdStmt = db.prepare<[string], UserRow>(
  `SELECT ${USER_COLUMNS} FROM users WHERE id = ?`,
);
const insertUserStmt = db.prepare<[string, string, string, string]>(
  'INSERT INTO users (id, email, name, google_sub) VALUES (?, ?, ?, ?)',
);
const updateUserProfileStmt = db.prepare<[string, string, string]>(
  "UPDATE users SET name = ?, google_sub = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
);

export const users = {
  findByEmail(email: string): UserRow | undefined {
    return selectUserByEmailStmt.get(email);
  },
  create(input: NewUser): UserRow {
    insertUserStmt.run(input.id, input.email, input.name, input.googleSub);
    return selectUserByIdStmt.get(input.id) as UserRow;
  },
  updateProfile(userId: string, name: string, googleSub: string): void {
    updateUserProfileStmt.run(name, googleSub, userId);
  },
};
