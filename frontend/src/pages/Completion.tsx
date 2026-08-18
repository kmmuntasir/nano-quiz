import { Link, useLocation, useParams } from 'react-router-dom';
import type { SubmitResult } from '../api/types';
import TopBar from '../components/TopBar';
import { formatDuration } from '../utils/formatDuration';

interface CompletionLocationState {
  result?: SubmitResult;
}

const CARD_CLASS =
  'flex w-full max-w-md flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 md:max-w-lg md:gap-5 md:p-8 dark:border-slate-800 dark:bg-slate-900';

export default function Completion() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = location.state as CompletionLocationState | null;
  const result = state?.result;

  return (
    <div className="flex min-h-screen flex-col bg-brand-50 font-sans dark:bg-slate-950">
      <TopBar />
      <main className="flex flex-1 flex-col items-center p-page">
        {result === undefined ? (
          <section className={CARD_CLASS}>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Result unavailable
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your result for this quiz can no longer be shown. Finish a quiz to see your score.
            </p>
            <Link
              to="/"
              className="rounded-md bg-brand-500 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-600"
            >
              Back to quizzes
            </Link>
          </section>
        ) : (
          <section className={CARD_CLASS}>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Quiz complete
            </h1>
            <p className="text-2xl font-bold text-slate-900 tabular-nums md:text-4xl dark:text-slate-100">
              You scored {result.correctCount} of {result.totalQuestions}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Time: {formatDuration(result.durationMs)}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row md:gap-3">
              <Link
                to={`/quizzes/${id}/leaderboard`}
                className="flex-1 rounded-md bg-brand-500 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-600"
              >
                View leaderboard
              </Link>
              <Link
                to="/"
                className="flex-1 rounded-md border border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:border-brand-400 hover:ring-1 hover:ring-brand-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-400 dark:hover:ring-brand-400"
              >
                Back to quizzes
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
