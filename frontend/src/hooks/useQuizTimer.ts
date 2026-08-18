import { useEffect, useState } from 'react';

const TICK_INTERVAL_MS = 250;
const MS_PER_SECOND = 1000;

export interface UseQuizTimerOptions {
  /** Total countdown duration in seconds. */
  seconds: number;
  /** While false the timer is inert: no interval, no timeout. */
  active: boolean;
  /** Changing this value re-arms the timer with a fresh deadline. */
  resetKey?: string | number;
  /** Fires exactly once per arming when the countdown reaches zero. */
  onTimeout: () => void;
}

export interface UseQuizTimerResult {
  /** Whole seconds left until the deadline (ceil). */
  remaining: number;
}

export function useQuizTimer(options: UseQuizTimerOptions): UseQuizTimerResult {
  const { seconds, active, resetKey, onTimeout } = options;
  const [remaining, setRemaining] = useState(seconds);

  const armKey = `${active}|${seconds}|${resetKey ?? ''}`;
  const [prevArmKey, setPrevArmKey] = useState(armKey);
  if (prevArmKey !== armKey) {
    // Adjusting state during render (props-only, no impure reads) so the
    // countdown reads the full duration the instant the timer (re)arms —
    // avoids a sync setState in the effect body.
    setPrevArmKey(armKey);
    setRemaining(seconds);
  }

  useEffect(() => {
    if (!active) return;

    // Deadline-based so ticks stay accurate even if the interval drifts.
    const deadline = Date.now() + seconds * MS_PER_SECOND;
    let fired = false;

    const tick = () => {
      const left = Math.ceil((deadline - Date.now()) / MS_PER_SECOND);
      setRemaining(left);
      if (left <= 0 && !fired) {
        fired = true;
        window.clearInterval(intervalId);
        onTimeout();
      }
    };

    const intervalId = window.setInterval(tick, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
    // onTimeout identity is intentionally excluded: callers may pass an
    // inline closure per render; re-arming on every tick would break the
    // fired-exactly-once guarantee.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, seconds, resetKey]);

  return { remaining };
}
