import { useState } from 'react';
import type { Quiz } from '../api/types';
import { formatRelativeTime } from '../hooks/useRelativeTime';

export interface StartQuizButtonProps {
  quiz: Quiz;
  now?: Date;
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

export default function StartQuizButton({ quiz, now = new Date() }: StartQuizButtonProps) {
  const [noticeVisible, setNoticeVisible] = useState(false);
  const canStart = quiz.canStart;
  const reason = canStart ? null : disabledReason(quiz, now);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!canStart}
        aria-disabled={!canStart}
        onClick={() => setNoticeVisible(true)}
        className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
      >
        Start quiz
      </button>
      {reason !== null && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{reason}</p>
      )}
      {canStart && noticeVisible && (
        <p className="text-xs text-brand-600 dark:text-brand-300" role="status">
          Quiz taking is coming in the next release
        </p>
      )}
    </div>
  );
}
