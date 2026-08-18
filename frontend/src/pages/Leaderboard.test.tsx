import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { LeaderboardData } from '../api/types';
import { server } from '../test/server';
import { renderApp, seedSession } from '../test/utils';

const FIXTURE: LeaderboardData = {
  quizId: 'q1',
  page: 1,
  pageSize: 20,
  total: 2,
  entries: [
    { rank: 1, name: 'Ada Lovelace', score: 5, durationMs: 65000 },
    { rank: 2, name: 'Grace Hopper', score: 4, durationMs: 30000 },
  ],
};

function mockLeaderboard(data: LeaderboardData): void {
  server.use(http.get('/api/quizzes/:id/leaderboard', () => HttpResponse.json(data)));
}

function mockLeaderboardError(): void {
  server.use(
    http.get(
      '/api/quizzes/:id/leaderboard',
      () =>
        new HttpResponse(
          JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' }),
          { status: 500 },
        ),
    ),
  );
}

function renderLeaderboard(): void {
  window.history.replaceState({}, '', '/quizzes/q1/leaderboard');
  seedSession();
  renderApp();
}

describe('Leaderboard', () => {
  it('should_render_ranked_rows_when_entries_exist', async () => {
    mockLeaderboard(FIXTURE);
    renderLeaderboard();

    expect(await screen.findByText('1. Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('2. Grace Hopper')).toBeInTheDocument();
    expect(screen.getAllByText('5 pts').length).toBeGreaterThan(0);
    expect(screen.getByText('1m 05s')).toBeInTheDocument();
    expect(screen.getByText('30s')).toBeInTheDocument();
  });

  it('should_show_alert_and_recover_when_fetch_fails', async () => {
    mockLeaderboardError();
    renderLeaderboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    mockLeaderboard(FIXTURE);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('1. Ada Lovelace')).toBeInTheDocument();
  });

  it('should_show_empty_state_when_no_entries', async () => {
    mockLeaderboard({ ...FIXTURE, entries: [], total: 0 });
    renderLeaderboard();

    expect(await screen.findByText('No results yet')).toBeInTheDocument();
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
  });

  it('should_render_back_link_to_completion', async () => {
    mockLeaderboard(FIXTURE);
    renderLeaderboard();

    expect(await screen.findByRole('link', { name: 'Back to result' })).toHaveAttribute(
      'href',
      '/quizzes/q1/completion',
    );
  });
});
