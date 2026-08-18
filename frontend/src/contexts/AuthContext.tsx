import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SESSION_EXPIRED_QUERY_PARAM,
  setAuthToken,
  setSessionExpiredHandler,
} from '../api/client';
import {
  AUTH_STORAGE_KEY,
  AuthContext,
  type AuthContextValue,
  type AuthUser,
  type StoredSession,
} from './auth';

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const user = candidate.user;
  return (
    typeof candidate.token === 'string' &&
    typeof user === 'object' &&
    user !== null &&
    typeof (user as Record<string, unknown>).id === 'string' &&
    typeof (user as Record<string, unknown>).name === 'string' &&
    typeof (user as Record<string, unknown>).email === 'string' &&
    typeof (user as Record<string, unknown>).isAdmin === 'boolean'
  );
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const [session, setSession] = useState<StoredSession | null>(readStoredSession);

  useEffect(() => {
    setAuthToken(readStoredSession()?.token ?? null);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setSession(null);
      navigate(`/login?${SESSION_EXPIRED_QUERY_PARAM}=1`, { replace: true });
    });
    return () => {
      setSessionExpiredHandler(null);
    };
  }, [navigate]);

  const signIn = useCallback((token: string, user: AuthUser) => {
    const nextSession: StoredSession = { token, user };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
    setAuthToken(token);
    setSession(nextSession);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthToken(null);
    setSession(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAdmin: session?.user.isAdmin ?? false,
      signIn,
      signOut,
    }),
    [session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}