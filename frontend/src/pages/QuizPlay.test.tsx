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

const QUESTION = {
  seq: 1,
  total: 10,
  text: 'What year was the company founded?',
  options: ['2019', '2020', '2021'],
};

function renderAt(path: string, state: unknown): void {
  window.history.replaceState(state, '', path);
  seedSession();
  renderApp();
}

describe('QuizPlay', () => {
  it('should_render_first_question_when_location_state_carries_session', async () => {
    server.use(
      http.get(`/api/quizzes/${SESSION.quizId}/question/1`, () => HttpResponse.json(QUESTION)),
    );
    renderAt('/quizzes/q-live/play', { usr: { session: SESSION }, key: 'test', idx: 0 });

    expect(await screen.findByRole('heading', { name: QUESTION.text })).toBeInTheDocument();
    expect(screen.getByText('1 of 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2020' })).toBeInTheDocument();
  });

  it('should_redirect_home_when_location_state_has_no_session', async () => {
    server.use(http.get('/api/quizzes', () => HttpResponse.json([])));
    renderAt('/quizzes/q-live/play', null);

    expect(await screen.findByText('No quizzes yet')).toBeInTheDocument();
    expect(screen.queryByText('1 of 10')).not.toBeInTheDocument();
  });
});
