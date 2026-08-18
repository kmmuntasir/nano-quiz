import type { LeaderboardData } from '../api/types';
import { formatDuration } from '../utils/formatDuration';

const CARD_CLASS =
  'flex w-full max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900';

const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600';

const PAGINATION_BUTTON_CLASS =
  'rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

interface LeaderboardTableProps {
  data: LeaderboardData;
  onPageChange: (page: number) => void;
}

export default function LeaderboardTable({ data, onPageChange }: LeaderboardTableProps) {
  const page = data.page;

  if (data.entries.length === 0 && data.total === 0) {
    return (
      <div className={CARD_CLASS}>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Leaderboard</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">No results yet</p>
      </div>
    );
  }

  if (data.entries.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Leaderboard</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This page is beyond the last result.
        </p>
        <button type="button" onClick={() => onPageChange(1)} className={PRIMARY_BUTTON_CLASS}>
          Back to page 1
        </button>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <section className={CARD_CLASS}>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Leaderboard</h1>
      <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {data.entries.map((entry) => (
          <li
            key={entry.rank}
            className="flex items-center justify-between gap-2 py-2 text-sm"
          >
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {entry.rank}. {entry.name}
            </span>
            <span className="flex gap-3 text-slate-600 dark:text-slate-400">
              <span>{entry.score} pts</span>
              <span>{formatDuration(entry.durationMs)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className={PAGINATION_BUTTON_CLASS}
        >
          Previous
        </button>
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Page {page} of {totalPages} · {data.total} entries
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page * data.pageSize >= data.total}
          aria-label="Next page"
          className={PAGINATION_BUTTON_CLASS}
        >
          Next
        </button>
      </div>
    </section>
  );
}
