import path from 'node:path';
import { pathToFileURL } from 'node:url';
import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import { config } from './config.js';
import { db } from './db/index.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { quizzesRouter } from './routes/quizzes.js';
import { logger } from './utils/logger.js';

const KNOWN_STATUS_BY_ERROR_CODE: Readonly<Record<string, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  INVALID_ID_TOKEN: 401,
  FORBIDDEN_DOMAIN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
const GENERIC_SERVER_MESSAGE = 'Internal server error.';
const GENERIC_CLIENT_MESSAGE = 'Request could not be processed.';
const FORCE_EXIT_AFTER_MS = 5000;

interface HttpErrorShape {
  status?: unknown;
  code?: unknown;
  message?: unknown;
}

function getHttpErrorShape(err: unknown): HttpErrorShape {
  return typeof err === 'object' && err !== null ? (err as HttpErrorShape) : {};
}

export const app = express();

app.disable('x-powered-by');

// Restrict CORS to the configured frontend origin exactly — never '*'.
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/health', healthRouter);

// Unmounted routes → envelope-shaped 404.
app.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found.' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  void _next; // Express identifies error middleware by its 4-arg arity.
  const { status, code, message } = getHttpErrorShape(err);
  const errorCode =
    typeof code === 'string' && code !== '' ? code : INTERNAL_ERROR_CODE;
  const statusCode =
    typeof status === 'number' && status >= 400 && status < 600
      ? status
      : (KNOWN_STATUS_BY_ERROR_CODE[errorCode] ?? 500);
  const isKnownErrorCode = errorCode in KNOWN_STATUS_BY_ERROR_CODE;
  const safeMessage =
    isKnownErrorCode && typeof message === 'string' && message !== ''
      ? message
      : statusCode === 500
        ? GENERIC_SERVER_MESSAGE
        : GENERIC_CLIENT_MESSAGE;

  logger.error('request failed', {
    status: statusCode,
    code: errorCode,
    message: typeof message === 'string' ? message : undefined,
  });
  res.status(statusCode).json({ error: errorCode, message: safeMessage });
});

export function start(): Server {
  const server = app.listen(config.port, () => {
    logger.info('nanoquiz backend listening', { port: config.port });
  });

  server.on('error', (err: Error) => {
    logger.error('failed to start http server', { message: err.message });
    process.exit(1);
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('shutting down', { signal });

    const forceExitTimer = setTimeout(() => {
      logger.warn('graceful shutdown timed out; forcing exit');
      db.close();
      process.exit(1);
    }, FORCE_EXIT_AFTER_MS);
    forceExitTimer.unref();

    server.close(() => {
      db.close();
      logger.info('shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isEntryPoint) {
  start();
}
