import { Navigate, useLocation } from 'react-router-dom';
import type { QuizSession } from '../api/types';
import TopBar from '../components/TopBar';

interface QuizPlayLocationState {
  session?: QuizSession;
}

export default function QuizPlay() {
  const location = useLocation();
  const state = location.state as QuizPlayLocationState | null;
  const session = state?.session;

  if (!session) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-brand-50 font-sans dark:bg-slate-950">
      <TopBar />
      <main className="flex flex-1 flex-col items-center p-page">
        <div className="w-full max-w-md">
          <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Quiz started
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {session.questionCount} questions · {session.timeLimitSeconds}s per question
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The question flow is coming next
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
