import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, fetchLeaderboard } from '../api/client';
import type { LeaderboardData } from '../api/types';
import TopBar from '../components/TopBar';
import { formatDuration } from '../utils/formatDuration';

const ROW_SKELETON_COUNT = 5;

const CARD_CLASS =
  'flex w-full max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900';

export default function Leaderboard() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const load = useCallback(async () => {
    if (id === undefined) return;
    try {
      const leaderboard = await fetchLeaderboard(id);
      setData(leaderboard);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.',
      );
    }
  }, [id]);

  useEffect(() => {
    // Data fetch on mount/re-entry; setState happens async after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, retryCount]);

  return (
    <div className="flex min-h-screen flex-col bg-brand-50 font-sans dark:bg-slate-950">
      <TopBar />
      <main className="flex flex-1 flex-col items-center p-page">
        <div className="w-full max-w-md">
          {data === null && error === null && (
            <div className={CARD_CLASS} aria-busy="true" aria-label="Loading leaderboard">
              {Array.from({ length: ROW_SKELETON_COUNT }, (_, index) => (
                <div
                  key={index}
                  className="h-6 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          )}
          {error !== null && (
            <div className={CARD_CLASS}>
              <p role="alert" className="text-sm text-slate-600 dark:text-slate-300">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Retry
              </button>
            </div>
          )}
          {data !== null && data.entries.length === 0 && (
            <div className={CARD_CLASS}>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Leaderboard
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">No results yet</p>
              <Link
                to={`/quizzes/${id}/completion`}
                className="rounded-md bg-brand-500 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-600"
              >
                Back to result
              </Link>
            </div>
          )}
          {data !== null && data.entries.length > 0 && (
            <section className={CARD_CLASS}>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Leaderboard
              </h1>
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
              <Link
                to={`/quizzes/${id}/completion`}
                className="rounded-md border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Back to result
              </Link>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
