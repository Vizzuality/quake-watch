import { type TimeFilters, getTimeWindow } from './search-schema';
import type { Earthquake } from './types';

type PlaybackWindow = '24h' | '7d';
export type TimeRange = { start: number; end: number };
export type HistogramBin = { start: number; end: number; count: number };

const DAY_MS = 86_400_000;
const WINDOW_MS: Record<PlaybackWindow, number> = { '24h': DAY_MS, '7d': 7 * DAY_MS };

export const AGE_OPACITY_FLOOR = 0.25;
export const PLAYBACK_DURATION_MS = 48_000;

export function getLoadedRange(earthquakes: Earthquake[]): TimeRange | null {
  if (earthquakes.length === 0) return null;
  return earthquakes.reduce(
    (range, { time }) => ({ start: Math.min(range.start, time), end: Math.max(range.end, time) }),
    { start: Number.POSITIVE_INFINITY, end: Number.NEGATIVE_INFINITY },
  );
}

export function getTimelineRange(input: {
  earthquakes: Earthquake[];
  nowMs: number;
}): TimeRange | null {
  const { earthquakes, nowMs } = input;
  const loaded = getLoadedRange(earthquakes);
  if (!loaded) return null;
  return { start: loaded.start, end: Math.max(loaded.start, nowMs) };
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

export type TimeUnit = 'hour' | 'day' | 'week' | 'month';
export type HistogramUnit = TimeUnit;

const HOUR_UNIT_MAX_MS = 30 * 3_600_000;
const DAY_UNIT_MAX_MS = 16 * DAY_MS;
const WEEK_UNIT_MAX_MS = 120 * DAY_MS;

export function getTimeUnit(range: TimeRange): TimeUnit {
  const span = range.end - range.start;
  if (span <= HOUR_UNIT_MAX_MS) return 'hour';
  if (span <= DAY_UNIT_MAX_MS) return 'day';
  if (span <= WEEK_UNIT_MAX_MS) return 'week';
  return 'month';
}

export function getHistogramUnit(range: TimeRange): HistogramUnit {
  return getTimeUnit(range);
}

function getBinStart(time: number, unit: HistogramUnit): Date {
  const date = new Date(time);
  if (unit === 'hour') {
    date.setMinutes(0, 0, 0);
    return date;
  }
  date.setHours(0, 0, 0, 0);
  if (unit === 'week') date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  if (unit === 'month') date.setDate(1);
  return date;
}

function getNextBinStart(start: number, unit: HistogramUnit): number {
  const date = new Date(start);
  if (unit === 'hour') date.setHours(date.getHours() + 1);
  if (unit === 'day') date.setDate(date.getDate() + 1);
  if (unit === 'week') date.setDate(date.getDate() + 7);
  if (unit === 'month') date.setMonth(date.getMonth() + 1);
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

export function getPlaybackSpeed(range: TimeRange): number {
  return (range.end - range.start) / PLAYBACK_DURATION_MS;
}

export function getShownCount(sortedTimes: ArrayLike<number>, playhead: number | null): number {
  if (playhead === null) return sortedTimes.length;
  let low = 0;
  let high = sortedTimes.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sortedTimes[middle] <= playhead) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function getSortedByTime<T extends { time: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.time - b.time);
}

export function getPassedItems<T>(
  sorted: readonly T[],
  sortedTimes: ArrayLike<number>,
  from: number | null,
  to: number | null,
): T[] {
  if (from === null || to === null || to <= from) return [];
  return sorted.slice(getShownCount(sortedTimes, from), getShownCount(sortedTimes, to));
}

export function getShownEarthquakes<T extends { time: number }>(
  earthquakes: readonly T[],
  playhead: number | null,
): readonly T[] {
  if (playhead === null) return earthquakes;
  return earthquakes.filter(({ time }) => time <= playhead);
}

export function getIntervalRange(filters: TimeFilters, fetchedAt: number): TimeRange {
  return getTimeWindow(filters, fetchedAt);
}
