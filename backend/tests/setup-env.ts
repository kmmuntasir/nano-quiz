// Deterministic base env for every backend test process. Runs before test
// files are imported, so src/config.ts and src/db/index.ts read these values
// (dotenv does not override vars already present in process.env).
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ADMIN_EMAILS = 'admin@nanoquiz.app,Owner@Example.com';
process.env.DB_PATH = ':memory:';
process.env.RESTRICT_DOMAIN = '';