import { render } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from '../App';
import { AUTH_STORAGE_KEY } from '../contexts/auth';
import type { StoredSession } from '../contexts/auth';
import { TEST_TOKEN, TEST_USER } from './server';

export function seedSession(session?: StoredSession): void {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify(session ?? { token: TEST_TOKEN, user: TEST_USER }),
  );
}

// Mirrors the provider stack from main.tsx (GoogleOAuthProvider is replaced by
// the test double; AuthProvider/ThemeProvider/BrowserRouter come from App).
export function renderApp(): ReturnType<typeof render> {
  return render(
    <GoogleOAuthProvider clientId="test-client-id">
      <App />
    </GoogleOAuthProvider>,
  );
}