import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { AUTH_STORAGE_KEY } from '../contexts/auth';
import { TEST_TOKEN, TEST_USER, server } from '../test/server';
import { renderApp } from '../test/utils';

async function renderLoginPage(): Promise<void> {
  window.history.replaceState({}, '', '/login');
  renderApp();
  await screen.findByRole('heading', { name: 'NanoQuiz' });
}

describe('Login', () => {
  it('should_persist_session_and_redirect_to_home_when_google_sign_in_succeeds', async () => {
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));

    expect(await screen.findByText('Your quiz list will appear here')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? 'null');
    expect(stored).toEqual({ token: TEST_TOKEN, user: TEST_USER });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('should_show_server_message_and_stay_on_login_when_domain_is_forbidden', async () => {
    server.use(
      http.post('/api/auth/google', () =>
        HttpResponse.json(
          { error: 'FORBIDDEN_DOMAIN', message: 'Sign-in is restricted to @example.com accounts.' },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sign-in is restricted to @example.com accounts.');
    expect(screen.getByRole('heading', { name: 'NanoQuiz' })).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('should_show_fallback_message_and_stay_on_login_when_id_token_is_invalid', async () => {
    server.use(
      http.post('/api/auth/google', () =>
        HttpResponse.json(
          { error: 'INVALID_ID_TOKEN', message: 'Google ID token could not be verified.' },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sign-in failed. Please try again.');
    expect(screen.getByRole('heading', { name: 'NanoQuiz' })).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});