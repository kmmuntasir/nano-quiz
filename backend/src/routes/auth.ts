import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import type { TokenPayload } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db, users } from '../db/index.js';
import type { UserRow } from '../db/index.js';
import { logger } from '../utils/logger.js';

const TOKEN_TTL = '2h';
const VALIDATION_ERROR = 'VALIDATION_ERROR';
const INVALID_ID_TOKEN = 'INVALID_ID_TOKEN';
const FORBIDDEN_DOMAIN = 'FORBIDDEN_DOMAIN';

const oauthClient = new OAuth2Client();

interface UserProfile {
  email: string;
  name: string;
  googleSub: string;
}

function extractIdToken(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const idToken = (body as Record<string, unknown>).idToken;
  if (typeof idToken !== 'string' || idToken.trim() === '') {
    return null;
  }
  return idToken;
}

const upsertUserByEmail = db.transaction((profile: UserProfile): UserRow => {
  const existing = users.findByEmail(profile.email);
  if (existing === undefined) {
    return users.create({
      id: randomUUID(),
      email: profile.email,
      name: profile.name,
      googleSub: profile.googleSub,
    });
  }
  if (existing.name !== profile.name || existing.googleSub !== profile.googleSub) {
    users.updateProfile(existing.id, profile.name, profile.googleSub);
  }
  return { ...existing, ...profile };
});

async function handleGoogleSignIn(req: Request, res: Response): Promise<void> {
  const idToken = extractIdToken(req.body);
  if (idToken === null) {
    res.status(400).json({
      error: VALIDATION_ERROR,
      message: 'Request body must include a non-empty "idToken" string.',
    });
    return;
  }

  let payload: TokenPayload;
  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });
    const tokenPayload = ticket.getPayload();
    if (tokenPayload === undefined) {
      res.status(401).json({
        error: INVALID_ID_TOKEN,
        message: 'Google ID token could not be verified.',
      });
      return;
    }
    payload = tokenPayload;
  } catch {
    res.status(401).json({
      error: INVALID_ID_TOKEN,
      message: 'Google ID token could not be verified.',
    });
    return;
  }

  const email = payload.email?.toLowerCase();
  if (email === undefined || email === '') {
    res.status(401).json({
      error: INVALID_ID_TOKEN,
      message: 'Google ID token is missing an email address.',
    });
    return;
  }

  const restrictedDomains = config.restrictDomains;
  if (restrictedDomains !== undefined && restrictedDomains.length > 0) {
    const atIndex = email.indexOf('@');
    const emailDomain = atIndex >= 0 ? email.slice(atIndex + 1) : '';
    if (!restrictedDomains.includes(emailDomain)) {
      res.status(403).json({
        error: FORBIDDEN_DOMAIN,
        message: `Sign-in is restricted to @${restrictedDomains.join(', @')} accounts.`,
      });
      return;
    }
  }

  const user = upsertUserByEmail({
    email,
    name: payload.name !== undefined && payload.name !== '' ? payload.name : email,
    googleSub: payload.sub,
  });

  const isAdmin = config.adminEmails.some(
    (adminEmail) => adminEmail.toLowerCase() === email,
  );

  const token = jwt.sign({ userId: user.id, isAdmin }, config.jwtSecret, {
    expiresIn: TOKEN_TTL,
  });

  logger.info('google sign-in succeeded', { userId: user.id, isAdmin });
  res.status(200).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, isAdmin },
  });
}

export const authRouter = Router();
authRouter.post('/google', handleGoogleSignIn);