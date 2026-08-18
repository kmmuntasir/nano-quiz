import type { Quiz, QuizSession } from '../api/types';
import StartQuizButton from './StartQuizButton';

export interface QuizCardProps {
  quiz: Quiz;
  now?: Date;
  onStarted?: (session: QuizSession) => void;
  onStartError?: () => void;
}

type QuizStatus = 'live' | 'upcoming' | 'ended';

const STATUS_LABEL: Record<QuizStatus, string> = {
  live: 'Live',
  upcoming: 'Upcoming',
  ended: 'Ended',
};

const STATUS_STYLES: Record<QuizStatus, string> = {
  live: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  upcoming: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  ended: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

function deriveStatus(startAt: string, endAt: string, now: Date): QuizStatus {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const current = now.getTime();

  if (current < start) return 'upcoming';
  if (current >= end) return 'ended';
  return 'live';
}

function formatWindow(startAt: string, endAt: string): string {
  const format = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
  return `${format.format(new Date(startAt))} – ${format.format(new Date(endAt))}`;
}

export default function QuizCard({
  quiz,
  now = new Date(),
  onStarted,
  onStartError,
}: QuizCardProps) {
  const status = deriveStatus(quiz.startAt, quiz.endAt, now);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{quiz.title}</h2>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>
      {quiz.description && (
        <p className="text-sm text-slate-600 dark:text-slate-300">{quiz.description}</p>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {quiz.questionCount} questions · {quiz.timeLimitSeconds}s per question ·{' '}
        {formatWindow(quiz.startAt, quiz.endAt)}
      </p>
      {quiz.participated && (
        <p className="text-sm font-medium text-brand-600 dark:text-brand-300">
          You scored {quiz.userScore ?? 0}/{quiz.questionCount}
        </p>
      )}
      <StartQuizButton quiz={quiz} now={now} onStarted={onStarted} onStartError={onStartError} />
    </article>
  );
}
