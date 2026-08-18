import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, adminFetchQuizzes, deleteQuiz } from '../api/client';
import type { AdminQuiz } from '../api/types';
import TopBar from '../components/TopBar';

const ROW_SKELETON_COUNT = 4;

const BADGE_BASE_CLASS = 'rounded-full px-2 py-0.5 text-xs font-medium';

function formatWindow(startAt: string, endAt: string): string {
  return `${new Date(startAt).toLocaleString()} – ${new Date(endAt).toLocaleString()}`;
}

function QuizRow({ quiz, onDeleted }: QuizRowProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const playable = quiz.questionBankSize >= quiz.questionCount;
  const editable = quiz.attemptCount === 0;

  async function handleDelete(): Promise<void> {
    if (!window.confirm(`Delete quiz "${quiz.title}"? This cannot be undone.`)) return;
    try {
      await deleteQuiz(quiz.id);
      onDeleted(quiz.id);
    } catch (cause) {
      setDeleteError(
        cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.',
      );
    }
  }

  return (
    <tr className="border-t border-slate-200 dark:border-slate-800">
      <td className="px-3 py-3">
        <span className="font-medium text-slate-900 dark:text-slate-100">{quiz.title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          {quiz.questionCount} questions · {quiz.timeLimitSeconds}s ·{' '}
          <span className="md:hidden">{formatWindow(quiz.startAt, quiz.endAt)}</span>
        </span>
        {deleteError !== null && (
          <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
            {deleteError}
          </p>
        )}
      </td>
      <td className="hidden px-3 py-3 text-xs text-slate-500 dark:text-slate-400 md:table-cell">
        {formatWindow(quiz.startAt, quiz.endAt)}
      </td>
      <td className="px-3 py-3">
        <span className="block text-sm text-slate-700 dark:text-slate-300">
          {quiz.questionBankSize}/{quiz.questionCount}
        </span>
        {playable ? (
          <span className={`${BADGE_BASE_CLASS} bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300`}>
            Playable
          </span>
        ) : (
          <span className={`${BADGE_BASE_CLASS} bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300`}>
            Not playable
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-sm text-slate-700 dark:text-slate-300">
        {quiz.attemptCount} attempts
      </td>
      <td className="px-3 py-3">
        {editable ? (
          <span className={`${BADGE_BASE_CLASS} bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300`}>
            Editable
          </span>
        ) : (
          <span className={`${BADGE_BASE_CLASS} bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300`}>
            Locked
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {editable ? (
            <Link
              to={`/admin/quizzes/${quiz.id}/edit`}
              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Edit
            </Link>
          ) : (
            <span
              title="Quiz has attempts — editing locked"
              aria-disabled="true"
              className="cursor-not-allowed font-medium text-slate-400 dark:text-slate-600"
            >
              Edit
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="font-medium text-red-600 hover:underline dark:text-red-400"
          >
            Delete
          </button>
          <Link
            to={`/admin/quizzes/${quiz.id}/questions`}
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Questions
          </Link>
          <Link
            to={`/admin/quizzes/${quiz.id}/leaderboard`}
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Leaderboard
          </Link>
        </div>
      </td>
    </tr>
  );
}

interface QuizRowProps {
  quiz: AdminQuiz;
  onDeleted: (id: string) => void;
}

export default function Admin() {
  const [quizzes, setQuizzes] = useState<AdminQuiz[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await adminFetchQuizzes();
      setQuizzes(data);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.',
      );
    }
  }, []);

  useEffect(() => {
    // Data fetch on mount/re-entry; setState happens async after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, retryCount]);

  function handleDeleted(id: string): void {
    setQuizzes((current) => current?.filter((quiz) => quiz.id !== id) ?? current);
  }

  return (
    <div className="flex min-h-screen flex-col bg-brand-50 font-sans dark:bg-slate-950">
      <TopBar />
      <main className="flex flex-1 flex-col items-center p-page">
        <div className="w-full max-w-4xl lg:max-w-6xl">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Manage quizzes
            </h1>
            <Link
              to="/admin/quizzes/new"
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              New quiz
            </Link>
          </div>
          {quizzes === null && error === null && (
            <div
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              aria-busy="true"
              aria-label="Loading quizzes"
            >
              {Array.from({ length: ROW_SKELETON_COUNT }, (_, index) => (
                <div key={index} className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          )}
          {error !== null && (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-slate-200 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
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
          {quizzes !== null && quizzes.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-600 dark:text-slate-400">No quizzes yet</p>
            </div>
          )}
          {quizzes !== null && quizzes.length > 0 && (
            <table className="w-full rounded-lg border border-slate-200 bg-white text-left dark:border-slate-800 dark:bg-slate-900">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th scope="col" className="px-3 py-2">Quiz</th>
                  <th scope="col" className="hidden px-3 py-2 md:table-cell">Window</th>
                  <th scope="col" className="px-3 py-2">Bank</th>
                  <th scope="col" className="px-3 py-2">Attempts</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((quiz) => (
                  <QuizRow key={quiz.id} quiz={quiz} onDeleted={handleDeleted} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
