import { render } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import type { ReactElement } from 'react';
import App from '../App';
import { AUTH_STORAGE_KEY, AuthContext, type AuthContextValue } from '../contexts/auth';
import type { StoredSession } from '../contexts/auth';
import { TEST_TOKEN, TEST_USER } from './server';

export function seedSession(session?: StoredSession): void {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify(session ?? { token: TEST_TOKEN, user: TEST_USER }),
  );
}

const noop = () => undefined;

export function authContextValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: TEST_USER,
    token: TEST_TOKEN,
    isAdmin: false,
    signIn: noop,
    signOut: noop,
    ...overrides,
  };
}

// For component tests that need useAuth without the full app/provider stack.
export function renderWithAuth(
  ui: ReactElement,
  { isAdmin = false }: { isAdmin?: boolean } = {},
): ReturnType<typeof render> {
  return render(
    <AuthContext.Provider value={authContextValue({ isAdmin })}>{ui}</AuthContext.Provider>,
  );
}

// Mirrors the provider stack from main.tsx (GoogleOAuthProvider is replaced by
// the test double; AuthProvider/ThemeProvider/BrowserRouter come from App).
export function renderApp(ui: ReactElement = <App />): ReturnType<typeof render> {
  return render(
    <GoogleOAuthProvider clientId="test-client-id">{ui}</GoogleOAuthProvider>,
  );
}