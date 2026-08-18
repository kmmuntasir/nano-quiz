import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { QuizSession } from '../api/types';
import { server } from '../test/server';
import { renderApp, seedSession } from '../test/utils';

const SESSION: QuizSession = {
  seed: 'seed-1',
  quizId: 'q-live',
  questionCount: 10,
  timeLimitSeconds: 15,
};

function renderAt(path: string, state: unknown): void {
  window.history.replaceState(state, '', path);
  seedSession();
  renderApp();
}

describe('QuizPlay', () => {
  it('should_render_session_metadata_when_location_state_carries_session', async () => {
    // React Router persists location state as { usr, key, idx } in history.state.
    renderAt('/quizzes/q-live/play', { usr: { session: SESSION }, key: 'test', idx: 0 });

    expect(await screen.findByRole('heading', { name: 'Quiz started' })).toBeInTheDocument();
    expect(screen.getByText('10 questions · 15s per question')).toBeInTheDocument();
  });

  it('should_redirect_home_when_location_state_has_no_session', async () => {
    server.use(http.get('/api/quizzes', () => HttpResponse.json([])));
    renderAt('/quizzes/q-live/play', null);

    expect(await screen.findByText('No quizzes yet')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Quiz started' })).not.toBeInTheDocument();
  });
});
