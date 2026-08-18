interface AppEnv {
  apiBaseUrl: string;
  googleClientId: string;
}

const MISSING_ENV_HINT =
  'Copy frontend/.env.example to frontend/.env, set the value, and restart the dev server.';

function requireEnv(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable ${name}. ${MISSING_ENV_HINT}`);
  }
  return value;
}

export function validateEnv(): AppEnv {
  return {
    apiBaseUrl: requireEnv(import.meta.env.VITE_API_BASE_URL, 'VITE_API_BASE_URL'),
    googleClientId: requireEnv(import.meta.env.VITE_GOOGLE_CLIENT_ID, 'VITE_GOOGLE_CLIENT_ID'),
  };
}
