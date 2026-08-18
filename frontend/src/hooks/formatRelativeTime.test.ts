import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './useRelativeTime';

const NOW = new Date('2026-08-18T12:00:00');

describe('formatRelativeTime', () => {
  it('returns ends-in days label when quiz is live', () => {
    const label = formatRelativeTime('2026-08-15T00:00:00', '2026-08-21T12:00:00', NOW);
    expect(label.label).toBe('Ends in 3 days');
  });

  it('returns ends-in hours label when quiz ends within a day', () => {
    const label = formatRelativeTime('2026-08-15T00:00:00', '2026-08-18T15:00:00', NOW);
    expect(label.label).toBe('Ends in 3 hours');
  });

  it('returns starts label when quiz has not started', () => {
    const label = formatRelativeTime('2026-08-20T00:00:00Z', '2026-08-31T00:00:00Z', NOW);
    expect(label.label).toBe('Starts Aug 20');
  });

  it('returns starts tomorrow label when quiz starts next day', () => {
    const label = formatRelativeTime('2026-08-19T12:00:00Z', '2026-08-31T00:00:00Z', NOW);
    expect(label.label).toBe('Starts tomorrow');
  });

  it('returns ended label when quiz window has passed', () => {
    const label = formatRelativeTime('2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z', NOW);
    expect(label.label).toBe('Ended Aug 1');
  });
});
