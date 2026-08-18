import { db, dbPath } from './db/index.js';
import { applySchema } from './db/schema.js';
import { logger } from './utils/logger.js';

applySchema(db);

const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };

logger.info('Seed complete', { dbPath, users: userCount.count });
db.close();
