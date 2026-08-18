import { render, screen } from '@testing-library/react';
import TimerCountdown from './TimerCountdown';

describe('TimerCountdown', () => {
  it('should_render_remaining_seconds_when_mounted', () => {
    render(<TimerCountdown remaining={12} />);

    expect(screen.getByRole('timer')).toHaveTextContent('12s');
  });

  it('should_render_zero_seconds_when_remaining_is_zero', () => {
    render(<TimerCountdown remaining={0} />);

    expect(screen.getByRole('timer')).toHaveTextContent('0s');
  });

  it('should_apply_urgent_classes_when_remaining_is_at_or_below_threshold', () => {
    render(<TimerCountdown remaining={5} />);

    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('5s');
    expect(timer).toHaveClass('text-red-600', 'dark:text-red-400');
    expect(timer).not.toHaveClass('text-slate-500');
  });

  it('should_apply_neutral_classes_when_remaining_is_above_threshold', () => {
    render(<TimerCountdown remaining={6} />);

    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('6s');
    expect(timer).toHaveClass('text-slate-500', 'dark:text-slate-400');
    expect(timer).not.toHaveClass('text-red-600');
  });
});
