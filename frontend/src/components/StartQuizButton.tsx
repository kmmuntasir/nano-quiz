import { useState } from 'react';
import { ApiError, startQuiz } from '../api/client';
import type { Quiz, QuizSession } from '../api/types';
import { useAuth } from '../hooks/useAuth';
import { formatRelativeTime } from '../hooks/useRelativeTime';

export interface StartQuizButtonProps {
  quiz: Quiz;
  now?: Date;
  onStarted?: (session: QuizSession) => void;
  onStartError?: () => void;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function disabledReason(quiz: Quiz, now: Date): string | null {
  if (quiz.participated) return `You scored ${quiz.userScore ?? 0}/${quiz.questionCount}`;

  const start = new Date(quiz.startAt);
  const end = new Date(quiz.endAt);

  if (now.getTime() >= end.getTime()) {
    return formatRelativeTime(quiz.startAt, quiz.endAt, now).label;
  }
  if (now.getTime() < start.getTime()) {
    return `Starts ${formatDate(start)}`;
  }
  return formatRelativeTime(quiz.startAt, quiz.endAt, now).label;
}

const GENERIC_START_ERROR = 'Could not start the quiz. Please try again.';

export default function StartQuizButton({
  quiz,
  now = new Date(),
  onStarted,
  onStartError,
}: StartQuizButtonProps) {
  const { isAdmin } = useAuth();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const canStart = quiz.canStart;
  const reason = canStart ? null : disabledReason(quiz, now);

  async function handleClick(): Promise<void> {
    setStarting(true);
    setStartError(null);
    try {
      const session = await startQuiz(quiz.id);
      onStarted?.(session);
    } catch (cause) {
      setStartError(cause instanceof ApiError ? cause.message : GENERIC_START_ERROR);
      onStartError?.();
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!canStart || starting || startError !== null}
        aria-disabled={!canStart}
        onClick={() => void handleClick()}
        className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
      >
        {starting ? 'Starting…' : isAdmin ? 'Preview quiz' : 'Start quiz'}
      </button>
      {reason !== null && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{reason}</p>
      )}
      {startError !== null && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {startError}
        </p>
      )}
    </div>
  );
}
