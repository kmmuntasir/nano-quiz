import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useQuizTimer } from './useQuizTimer';

const TEN_SECONDS = 10;

describe('useQuizTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should_decrement_remaining_when_time_passes', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useQuizTimer({ seconds: TEN_SECONDS, active: true, onTimeout }),
    );

    expect(result.current.remaining).toBe(TEN_SECONDS);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.remaining).toBe(7);
  });

  it('should_fire_onTimeout_exactly_once_when_expired', () => {
    const onTimeout = vi.fn();
    renderHook(() => useQuizTimer({ seconds: 2, active: true, onTimeout }));

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('should_not_fire_onTimeout_when_active_flips_false_before_expiry', () => {
    const onTimeout = vi.fn();
    const { result, rerender } = renderHook(
      (props: { active: boolean }) => useQuizTimer({ seconds: 3, active: props.active, onTimeout }),
      { initialProps: { active: true } },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(onTimeout).not.toHaveBeenCalled();
    expect(result.current.remaining).toBe(3);
  });

  it('should_reset_to_full_duration_when_resetKey_changes', () => {
    const onTimeout = vi.fn();
    const { result, rerender } = renderHook(
      (props: { resetKey: number }) =>
        useQuizTimer({ seconds: 5, active: true, resetKey: props.resetKey, onTimeout }),
      { initialProps: { resetKey: 1 } },
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.remaining).toBe(2);

    rerender({ resetKey: 2 });
    expect(result.current.remaining).toBe(5);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('should_not_fire_onTimeout_when_unmounted_before_expiry', () => {
    const onTimeout = vi.fn();
    const { unmount } = renderHook(() =>
      useQuizTimer({ seconds: 3, active: true, onTimeout }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
