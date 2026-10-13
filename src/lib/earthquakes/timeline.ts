import { getTimeRange } from './search-schema';
import type { EarthquakeSearch, Period, PlaybackWindow } from './search-schema';
import type { Earthquake } from './types';

export type TimeRange = { start: number; end: number };
export type HistogramBin = { start: number; end: number; count: number };

const DAY_MS = 86_400_000;
const WINDOW_MS: Record<PlaybackWindow, number> = { '24h': DAY_MS, '7d': 7 * DAY_MS };

export const AGE_OPACITY_FLOOR = 0.25;
export const PLAYBACK_DURATION_MS = 30_000;

export function getLoadedRange(earthquakes: Earthquake[]): TimeRange | null {
  if (earthquakes.length === 0) return null;
  return earthquakes.reduce(
    (range, { time }) => ({ start: Math.min(range.start, time), end: Math.max(range.end, time) }),
    { start: Number.POSITIVE_INFINITY, end: Number.NEGATIVE_INFINITY },
  );
}

export function getTimelineRange(input: {
  earthquakes: Earthquake[];
  search: Pick<EarthquakeSearch, 'period' | 'from' | 'to'>;
  nowMs: number;
}): TimeRange | null {
  const { earthquakes, search, nowMs } = input;
  const loaded = getLoadedRange(earthquakes);
  if (!loaded) return null;
  const periodEnd = getTimeRange(search, new Date(nowMs)).end?.getTime() ?? nowMs;
  return { start: loaded.start, end: Math.max(loaded.start, Math.min(periodEnd, nowMs)) };
}

export function getWindowMs(window: PlaybackWindow): number {
  return WINDOW_MS[window];
}

export function getPlaybackRange(input: {
  loaded: TimeRange;
  window: PlaybackWindow;
  t: number;
}): TimeRange {
  const { loaded, window, t } = input;
  return { start: Math.min(t, Math.max(loaded.start, t - getWindowMs(window))), end: t };
}

export function getDefaultT(loaded: TimeRange): number {
  return loaded.end;
}

export function getClampedT(t: string | undefined, loaded: TimeRange | null): number | null {
  if (!loaded) return null;
  const parsed = t === undefined ? Number.NaN : Date.parse(t);
  if (Number.isNaN(parsed)) return loaded.end;
  return Math.min(loaded.end, Math.max(loaded.start, parsed));
}

export type HistogramUnit = 'hour' | 'day';

export function getHistogramUnit(period: Period): HistogramUnit {
  return period === '24h' ? 'hour' : 'day';
}

function getBinStart(time: number, unit: HistogramUnit): Date {
  const date = new Date(time);
  if (unit === 'hour') date.setMinutes(0, 0, 0);
  else date.setHours(0, 0, 0, 0);
  return date;
}

function getNextBinStart(start: number, unit: HistogramUnit): number {
  const date = new Date(start);
  if (unit === 'hour') date.setHours(date.getHours() + 1);
  else date.setDate(date.getDate() + 1);
  return date.getTime();
}

export function getHistogramBins(
  earthquakes: Earthquake[],
  loaded: TimeRange,
  unit: HistogramUnit,
): HistogramBin[] {
  const bins: HistogramBin[] = [];
  let start = getBinStart(loaded.start, unit).getTime();
  do {
    const end = getNextBinStart(start, unit);
    bins.push({ start, end, count: 0 });
    start = end;
  } while (start <= loaded.end);
  for (const { time } of earthquakes) {
    if (time < loaded.start || time > loaded.end) continue;
    const bin = bins.find((candidate) => time >= candidate.start && time < candidate.end);
    if (bin) bin.count += 1;
  }
  return bins;
}

export function getAgeOpacity(ageMs: number, windowMs: number): number {
  if (ageMs < 0) return 0;
  const decayed = 1 - (ageMs / windowMs) * (1 - AGE_OPACITY_FLOOR);
  return Math.max(AGE_OPACITY_FLOOR, decayed);
}

export function getPlaybackT(input: { range: TimeRange; elapsedMs: number }): number {
  const { range, elapsedMs } = input;
  const span = range.end - range.start;
  if (span <= 0) return range.end;
  return Math.min(range.end, range.start + elapsedMs * (span / PLAYBACK_DURATION_MS));
}
