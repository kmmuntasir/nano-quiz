import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { apiClient, SESSION_EXPIRED_MESSAGE } from './api/client';
import { AUTH_STORAGE_KEY } from './contexts/auth';
import { server } from './test/server';
import { renderApp, seedSession } from './test/utils';

describe('App', () => {
  it('should_redirect_to_login_when_unauthenticated', async () => {
    renderApp();

    expect(await screen.findByRole('heading', { name: 'NanoQuiz' })).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('should_render_home_when_authenticated', async () => {
    seedSession();
    renderApp();

    expect(await screen.findByText('Your quiz list will appear here')).toBeInTheDocument();
  });

  it('should_show_session_expired_notice_when_an_authed_request_returns_401', async () => {
    seedSession();
    renderApp();
    await screen.findByText('Your quiz list will appear here');

    server.use(
      http.get('/api/quizzes', () =>
        HttpResponse.json(
          { error: 'UNAUTHORIZED', message: 'Authentication required.' },
          { status: 401 },
        ),
      ),
    );

    await expect(apiClient.get('/quizzes')).rejects.toMatchObject({
      error: 'UNAUTHORIZED',
      status: 401,
    });

    expect(await screen.findByText(SESSION_EXPIRED_MESSAGE)).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});