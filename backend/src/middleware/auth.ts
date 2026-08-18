import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express.Request declaration merging
  namespace Express {
    interface Request {
      userId?: string;
      isAdmin?: boolean;
    }
  }
}

interface AuthTokenPayload {
  userId: string;
  isAdmin: boolean;
}

const BEARER_PREFIX = 'Bearer ';
const UNAUTHORIZED_ERROR = 'UNAUTHORIZED';

function isAuthTokenPayload(payload: jwt.JwtPayload): payload is AuthTokenPayload {
  return (
    typeof payload.userId === 'string' &&
    typeof payload.isAdmin === 'boolean'
  );
}

function sendUnauthorized(res: Response, message: string): void {
  res.status(401).json({ error: UNAUTHORIZED_ERROR, message });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (header === undefined) {
    sendUnauthorized(res, 'Missing Authorization header.');
    return;
  }
  if (!header.startsWith(BEARER_PREFIX)) {
    sendUnauthorized(res, 'Malformed Authorization header. Expected "Bearer <token>".');
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (token === '') {
    sendUnauthorized(res, 'Malformed Authorization header.');
    return;
  }

  let payload: AuthTokenPayload;
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === 'string' || !isAuthTokenPayload(decoded)) {
      sendUnauthorized(res, 'Invalid token.');
      return;
    }
    payload = decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      sendUnauthorized(res, 'Token has expired.');
    } else {
      sendUnauthorized(res, 'Invalid token.');
    }
    return;
  }

  req.userId = payload.userId;
  req.isAdmin = payload.isAdmin;
  next();
}