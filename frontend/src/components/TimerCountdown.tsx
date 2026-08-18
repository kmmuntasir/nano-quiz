import { formatDuration } from '../utils/formatDuration';

export const URGENT_SECONDS_THRESHOLD = 5;

export interface TimerCountdownProps {
  /** Remaining whole seconds for the current question. */
  remaining: number;
}

export default function TimerCountdown({ remaining }: TimerCountdownProps) {
  const urgent = remaining <= URGENT_SECONDS_THRESHOLD;

  return (
    <p
      role="timer"
      aria-live="polite"
      className={`text-sm font-semibold tabular-nums md:text-base ${
        urgent ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      {formatDuration(remaining * 1000)}
    </p>
  );
}
