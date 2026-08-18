import { screen } from '@testing-library/react';
import type { SubmitResult } from '../api/types';
import { renderApp, seedSession } from '../test/utils';

const RESULT: SubmitResult = {
  score: 50,
  totalQuestions: 5,
  correctCount: 4,
  durationMs: 65000,
  participated: true,
};

function renderCompletion(result?: SubmitResult): void {
  window.history.replaceState(
    { usr: result === undefined ? {} : { result }, key: 'test', idx: 0 },
    '',
    '/quizzes/q1/completion',
  );
  seedSession();
  renderApp();
}

describe('Completion', () => {
  it('should_render_score_and_duration_when_state_carries_result', async () => {
    renderCompletion(RESULT);

    expect(await screen.findByRole('heading', { name: 'Quiz complete' })).toBeInTheDocument();
    expect(screen.getByText('You scored 4 of 5')).toBeInTheDocument();
    expect(screen.getByText('Time: 1m 05s')).toBeInTheDocument();
  });

  it('should_render_leaderboard_and_back_links_when_result_present', async () => {
    renderCompletion(RESULT);

    expect(await screen.findByRole('link', { name: 'View leaderboard' })).toHaveAttribute(
      'href',
      '/quizzes/q1/leaderboard',
    );
    expect(screen.getByRole('link', { name: 'Back to quizzes' })).toHaveAttribute('href', '/');
  });

  it('should_show_unavailable_message_when_no_result_state', async () => {
    renderCompletion();

    expect(await screen.findByRole('heading', { name: 'Result unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to quizzes' })).toBeInTheDocument();
    expect(screen.queryByText(/You scored/)).not.toBeInTheDocument();
  });

  it('should_not_render_participation_or_score_details_beyond_summary', async () => {
    renderCompletion(RESULT);

    await screen.findByRole('heading', { name: 'Quiz complete' });
    expect(screen.queryByText('50')).not.toBeInTheDocument();
    expect(screen.queryByText('true')).not.toBeInTheDocument();
  });
});
