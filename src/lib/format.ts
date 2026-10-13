const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function getRelativeTimeLabel(elapsedMs: number, locale: string): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (elapsedMs < HOUR_MS) return format.format(-Math.round(elapsedMs / MINUTE_MS), 'minute');
  return format.format(-Math.round(elapsedMs / HOUR_MS), 'hour');
}

export function getTimeLabel(time: number, now: number, locale: string, timeZone?: string): string {
  const elapsedMs = now - time;
  if (elapsedMs >= 0 && elapsedMs < DAY_MS) return getRelativeTimeLabel(elapsedMs, locale);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(time);
}

export function getKmLabel(km: number, locale: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilometer',
    maximumFractionDigits: fractionDigits,
  }).format(km);
}
