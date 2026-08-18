/**
 * Formats a duration in milliseconds as a compact countdown label.
 * Negative / non-finite inputs are clamped to "0s" so a late timer tick
 * can never render a nonsensical value like "-3s" or "NaNs".
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0s';

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}
