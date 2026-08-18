import path from 'node:path';
import dotenv from 'dotenv';

export interface AppConfig {
  port: number;
  frontendUrl: string;
  googleClientId: string;
  jwtSecret: string;
  adminEmails: string[];
  dbPath: string;
  restrictDomains: string[] | undefined;
}

const DEFAULT_PORT = 3000;
const DEFAULT_DB_PATH = 'backend/data/nanoquiz.sqlite';

const REQUIRED_ENV_VARS = [
  'FRONTEND_URL',
  'GOOGLE_CLIENT_ID',
  'JWT_SECRET',
  'ADMIN_EMAILS',
] as const;

dotenv.config({ path: path.join(import.meta.dirname, '..', '.env'), quiet: true });

const missingVars = REQUIRED_ENV_VARS.filter((name) => {
  const value = process.env[name];
  return value === undefined || value.trim() === '';
});

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missingVars.join(', ')}. ` +
      'Copy backend/.env.example to backend/.env and fill in the values.',
  );
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') {
    // Unreachable — guarded by the missing-vars check above.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function parseDomainList(value: string | undefined): string[] | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  return value
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain !== '');
}

export const config: Readonly<AppConfig> = Object.freeze({
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  frontendUrl: requireEnv('FRONTEND_URL'),
  googleClientId: requireEnv('GOOGLE_CLIENT_ID'),
  jwtSecret: requireEnv('JWT_SECRET'),
  adminEmails: parseCsv(requireEnv('ADMIN_EMAILS')),
  dbPath: process.env.DB_PATH ?? DEFAULT_DB_PATH,
  restrictDomains: parseDomainList(process.env.RESTRICT_DOMAIN),
});