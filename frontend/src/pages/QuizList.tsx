import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchQuizzes } from '../api/client';
import type { Quiz } from '../api/types';
import TopBar from '../components/TopBar';
import QuizCard from '../components/QuizCard';

const QUIZ_SKELETON_COUNT = 3;

export default function QuizList() {
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await fetchQuizzes();
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

  useEffect(() => {
    function onVisibilityChange(): void {
      if (document.visibilityState === 'visible') {
        void load();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [load]);

  return (
    <div className="flex min-h-screen flex-col bg-brand-50 font-sans dark:bg-slate-950">
      <TopBar />
      <main className="flex flex-1 flex-col items-center p-page">
        <div className="w-full max-w-md">
          {quizzes === null && error === null && (
            <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading quizzes">
              {Array.from({ length: QUIZ_SKELETON_COUNT }, (_, index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                />
              ))}
            </div>
          )}
          {error !== null && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
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
            <div className="flex flex-1 items-center justify-center py-16">
              <p className="text-sm text-slate-600 dark:text-slate-400">No quizzes yet</p>
            </div>
          )}
          {quizzes !== null && quizzes.length > 0 && (
            <ul className="flex flex-col gap-4">
              {quizzes.map((quiz) => (
                <li key={quiz.id}>
                  <QuizCard quiz={quiz} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
