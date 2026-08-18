import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { LeaderboardData } from '../api/types';
import LeaderboardTable from './LeaderboardTable';

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

function renderTable(data: LeaderboardData, onPageChange = vi.fn()): void {
  render(
    <MemoryRouter>
      <LeaderboardTable data={data} onPageChange={onPageChange} />
    </MemoryRouter>,
  );
}

describe('LeaderboardTable', () => {
  it('should_render_ranked_rows_and_durations_when_entries_exist', () => {
    renderTable(FIXTURE);

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1m 05s')).toBeInTheDocument();
    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1 · 2 entries')).toBeInTheDocument();
  });

  it('should_call_onPageChange_with_next_page_when_next_clicked', async () => {
    const onPageChange = vi.fn();
    renderTable({ ...FIXTURE, total: 25 }, onPageChange);

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('should_call_onPageChange_with_previous_page_when_previous_clicked', async () => {
    const onPageChange = vi.fn();
    renderTable({ ...FIXTURE, page: 2, total: 25 }, onPageChange);

    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('should_disable_previous_on_first_page_and_next_on_last_page', () => {
    renderTable({ ...FIXTURE, total: 25 });

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('should_disable_next_when_on_last_page', () => {
    renderTable({ ...FIXTURE, page: 2, total: 25 });

    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });

  it('should_show_empty_state_when_no_entries_and_no_total', () => {
    renderTable({ ...FIXTURE, entries: [], total: 0 });

    expect(screen.getByText('No results yet')).toBeInTheDocument();
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
  });

  it('should_show_beyond_last_state_and_call_onPageChange_when_back_to_page_1_clicked', async () => {
    const onPageChange = vi.fn();
    renderTable({ ...FIXTURE, page: 3, entries: [], total: 25 }, onPageChange);

    expect(screen.getByText('This page is beyond the last result.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back to page 1' }));

    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
