import type { LeaderboardData } from '../api/types';
import { formatDuration } from '../utils/formatDuration';

const CARD_CLASS =
  'flex w-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900';

const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600';

const PAGINATION_BUTTON_CLASS =
  'rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

const ROW_GRID_CLASS = 'md:grid md:grid-cols-[4rem_1fr_6rem_8rem] md:items-center md:gap-4';

const ROW_CLASS = `flex items-center justify-between gap-2 py-2 text-sm ${ROW_GRID_CLASS}`;

const HEADER_CLASS = `hidden py-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 ${ROW_GRID_CLASS}`;

const RANK_CHIP_BASE_CLASS =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums';

const RANK_CHIP_TOP_CLASS =
  'border border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-950 dark:text-brand-300';

const RANK_CHIP_DEFAULT_CLASS =
  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

function rankChipClass(rank: number): string {
  return rank <= 3
    ? `${RANK_CHIP_BASE_CLASS} ${RANK_CHIP_TOP_CLASS}`
    : `${RANK_CHIP_BASE_CLASS} ${RANK_CHIP_DEFAULT_CLASS}`;
}

interface LeaderboardTableProps {
  data: LeaderboardData;
  onPageChange: (page: number) => void;
}

export default function LeaderboardTable({ data, onPageChange }: LeaderboardTableProps) {
  const page = data.page;

  if (data.entries.length === 0 && data.total === 0) {
    return (
      <div className={CARD_CLASS}>
        <p className="text-sm text-slate-600 dark:text-slate-400">No results yet</p>
      </div>
    );
  }

  if (data.entries.length === 0) {
    return (
      <div className={CARD_CLASS}>
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
      <div
        className={HEADER_CLASS}
      >
        <span>Rank</span>
        <span>Name</span>
        <span className="text-right">Score</span>
        <span className="text-right">Time</span>
      </div>
      <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
        {data.entries.map((entry) => (
          <li key={entry.rank} className={ROW_CLASS}>
            <div className="flex min-w-0 items-center gap-2 md:contents">
              <span className={rankChipClass(entry.rank)}>{entry.rank}</span>
              <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                {entry.name}
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400 md:contents">
              <span className="tabular-nums md:text-right">{entry.score} pts</span>
              <span className="tabular-nums md:text-right">{formatDuration(entry.durationMs)}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex w-full items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
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
