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
    http.get('/api/quizzes/:id/leaderboard', ({ request }) => {
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

  it('should_render_first_page_with_previous_disabled_when_multi_page', async () => {
    mockPagedLeaderboard();
    renderLeaderboard();

    expect(await screen.findByText('1. User 1')).toBeInTheDocument();
    expect(screen.getByText('20. User 20')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2 · 25 entries')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('should_request_page_2_and_disable_next_when_on_last_page', async () => {
    mockPagedLeaderboard();
    renderLeaderboard();

    await screen.findByText('1. User 1');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText('21. User 21')).toBeInTheDocument();
    expect(screen.getByText('25. User 25')).toBeInTheDocument();
    expect(requestedPages.at(-1)).toBe(2);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });

  it('should_return_to_page_1_when_previous_clicked', async () => {
    mockPagedLeaderboard();
    renderLeaderboard();

    await screen.findByText('1. User 1');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('21. User 21');
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));

    expect(await screen.findByText('1. User 1')).toBeInTheDocument();
    expect(requestedPages.at(-1)).toBe(1);
  });

  it('should_retry_current_page_when_page_change_fetch_fails', async () => {
    mockPagedLeaderboard();
    renderLeaderboard();

    await screen.findByText('1. User 1');
    mockLeaderboardError();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');

    mockPagedLeaderboard();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('21. User 21')).toBeInTheDocument();
    expect(requestedPages.at(-1)).toBe(2);
  });

  it('should_offer_back_to_page_1_when_page_is_beyond_last', async () => {
    mockPagedLeaderboard();
    renderLeaderboard();

    await screen.findByText('1. User 1');
    mockLeaderboard({ quizId: 'q1', page: 3, pageSize: PAGE_SIZE, total: TOTAL_ENTRIES, entries: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText('This page is beyond the last result.')).toBeInTheDocument();

    mockPagedLeaderboard();
    await userEvent.click(screen.getByRole('button', { name: 'Back to page 1' }));

    expect(await screen.findByText('1. User 1')).toBeInTheDocument();
    expect(requestedPages.at(-1)).toBe(1);
  });
});
