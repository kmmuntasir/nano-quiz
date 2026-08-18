import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('should_render_seconds_only_when_duration_is_under_one_minute', () => {
    expect(formatDuration(12_500)).toBe('12s');
  });

  it('should_render_exact_seconds_when_duration_is_a_whole_second', () => {
    expect(formatDuration(7_000)).toBe('7s');
  });

  it('should_render_zero_seconds_when_duration_is_below_one_second', () => {
    expect(formatDuration(400)).toBe('0s');
  });

  it('should_render_minutes_and_padded_seconds_when_duration_is_at_least_one_minute', () => {
    expect(formatDuration(65_000)).toBe('1m 05s');
    expect(formatDuration(3_723_000)).toBe('62m 03s');
  });

  it('should_render_zero_seconds_when_duration_is_zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('should_render_zero_seconds_when_duration_is_negative', () => {
    expect(formatDuration(-2_500)).toBe('0s');
  });

  it('should_render_zero_seconds_when_duration_is_not_finite', () => {
    expect(formatDuration(Number.NaN)).toBe('0s');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0s');
  });
});
