import { createContext } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface StoredSession {
  token: string;
  user: AuthUser;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAdmin: boolean;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
}

export const AUTH_STORAGE_KEY = 'nanoquiz.auth';

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
