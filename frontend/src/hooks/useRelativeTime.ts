const DAY_MS = 24 * 60 * 60 * 1000;

function dayLabel(date: Date, now: Date): string {
  const diffDays = Math.round((date.getTime() - now.getTime()) / DAY_MS);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function endsInLabel(endAt: Date, now: Date): string {
  const remainingMs = endAt.getTime() - now.getTime();
  if (remainingMs <= DAY_MS) {
    const hours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
    return `Ends in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.max(2, Math.round(remainingMs / DAY_MS));
  return `Ends in ${days} days`;
}

export interface RelativeTimeLabel {
  label: string;
}

export function formatRelativeTime(startAt: string, endAt: string, now: Date): RelativeTimeLabel {
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (now.getTime() < start.getTime()) {
    return { label: `Starts ${dayLabel(start, now)}` };
  }
  if (now.getTime() >= end.getTime()) {
    return { label: `Ended ${dayLabel(end, now)}` };
  }
  return { label: endsInLabel(end, now) };
}
