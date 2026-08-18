import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { LeaderboardData } from '../api/types';
import { server } from '../test/server';
import { renderApp, seedSession } from '../test/utils';
import { TEST_USER } from '../test/server';

const PAGE_SIZE = 20;
const TOTAL_ENTRIES = 25;

const PAGE_ONE_ENTRIES = Array.from({ length: PAGE_SIZE }, (_, index) => ({
  rank: index + 1,
  name: `User ${index + 1}`,
  score: 5,
  durationMs: 30000,
}));

const PAGE_TWO_ENTRIES = Array.from({ length: TOTAL_ENTRIES - PAGE_SIZE }, (_, index) => ({
  rank: PAGE_SIZE + index + 1,
  name: `User ${PAGE_SIZE + index + 1}`,
  score: 3,
  durationMs: 45000,
}));

const requestedPages: number[] = [];

function mockPagedLeaderboard(): void {
  requestedPages.length = 0;
  server.use(
    http.get('/api/admin/quizzes/:id/leaderboard', ({ request }) => {
      const url = new URL(request.url);
      requestedPages.push(Number(url.searchParams.get('page')));
      const page = Number(url.searchParams.get('page') ?? '1');
      const entries = page === 1 ? PAGE_ONE_ENTRIES : PAGE_TWO_ENTRIES;
      return HttpResponse.json({
        quizId: 'q1',
        page,
        pageSize: PAGE_SIZE,
        total: TOTAL_ENTRIES,
        entries,
      } satisfies LeaderboardData);
    }),
  );
}

function mockLeaderboardError(): void {
  server.use(
    http.get(
      '/api/admin/quizzes/:id/leaderboard',
      () =>
        new HttpResponse(
          JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' }),
          { status: 500 },
        ),
    ),
  );
}

function renderAdminLeaderboard(): void {
  window.history.replaceState({}, '', '/admin/quizzes/q1/leaderboard');
  seedSession({ token: 'test-app-jwt', user: { ...TEST_USER, isAdmin: true } });
  renderApp();
}

describe('AdminLeaderboard', () => {
  it('should_render_rows_and_pagination_when_entries_exist', async () => {
    mockPagedLeaderboard();
    renderAdminLeaderboard();

    expect(await screen.findByText('User 1')).toBeInTheDocument();
    expect(screen.getByText('User 20')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2 · 25 entries')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('should_fetch_page_2_when_next_clicked', async () => {
    mockPagedLeaderboard();
    renderAdminLeaderboard();

    await screen.findByText('User 1');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText('User 21')).toBeInTheDocument();
    expect(requestedPages.at(-1)).toBe(2);
  });

  it('should_show_error_and_recover_when_retry_clicked', async () => {
    mockLeaderboardError();
    renderAdminLeaderboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');

    mockPagedLeaderboard();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('User 1')).toBeInTheDocument();
  });

  it('should_render_back_link_to_admin', async () => {
    mockPagedLeaderboard();
    renderAdminLeaderboard();

    expect(await screen.findByRole('link', { name: 'Back to admin' })).toHaveAttribute(
      'href',
      '/admin',
    );
  });
});
