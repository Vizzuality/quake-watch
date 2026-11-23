import { getFeltReachKm } from './intensity';
import { getDistanceKm } from './sequences';
import type { TimeRange } from './timeline';
import type { Earthquake } from './types';

export const AREA_MIN_RADIUS_KM = 300;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONDAY_OFFSET_MS = 4 * DAY_MS;
const THREE_HOUR_TICK_MAX_MS = 30 * HOUR_MS;
const HALF_DAY_TICK_MAX_MS = 4 * DAY_MS;
const DAY_TICK_MAX_MS = 16 * DAY_MS;
const WEEK_TICK_MAX_MS = 120 * DAY_MS;
const STRIP_DOT_LOOK = {
  minMagnitudePx: 2.5,
  maxMagnitudePx: 14,
  magnitudeOffset: 2.6,
  magnitudeScale: 3.4,
  basePx: 2.15,
  scale: 0.537,
  selectedMinPx: 4,
} as const;
const LABEL_END_FRACTION = 0.8;

export type StripTick = { time: number; x: number; kind: 'day' | 'hour' | 'date' | 'month' };
export type StripDot = { id: string; x: number; radius: number };
export type AreaStrip = {
  dots: StripDot[];
  selected: { x: number; radius: number };
  isLabelAtEnd: boolean;
};

export function getAreaRadiusKm(selected: Earthquake): number {
  return Math.max(AREA_MIN_RADIUS_KM, getFeltReachKm(selected));
}

export function getAreaEarthquakes(
  earthquakes: readonly Earthquake[],
  selected: Earthquake,
): Earthquake[] {
  const radiusKm = getAreaRadiusKm(selected);
  return earthquakes.filter((earthquake) => getDistanceKm(earthquake, selected) <= radiusKm);
}

export function getStripDotRadius(magnitude: number): number {
  const { minMagnitudePx, maxMagnitudePx, magnitudeOffset, magnitudeScale, basePx, scale } =
    STRIP_DOT_LOOK;
  const magnitudePx = Math.min(
    maxMagnitudePx,
    Math.max(minMagnitudePx, (magnitude - magnitudeOffset) * magnitudeScale),
  );
  return basePx + scale * magnitudePx;
}

function getFraction(time: number, { start, end }: TimeRange): number {
  return Math.min(1, Math.max(0, (time - start) / (end - start)));
}

function getTickKind(time: number): StripTick['kind'] {
  return time % DAY_MS === 0 ? 'day' : 'hour';
}

function getSteppedTimes(range: TimeRange, stepMs: number, offsetMs = 0): number[] {
  const times: number[] = [];
  const first = Math.ceil((range.start - offsetMs) / stepMs) * stepMs + offsetMs;
  for (let time = first; time <= range.end; time += stepMs) times.push(time);
  return times;
}

function getMonthStarts(range: TimeRange): number[] {
  const times: number[] = [];
  const start = new Date(range.start);
  for (let month = start.getUTCMonth(); ; month++) {
    const time = Date.UTC(start.getUTCFullYear(), month, 1);
    if (time > range.end) return times;
    if (time >= range.start) times.push(time);
  }
}

function getTicks(
  range: TimeRange,
  times: number[],
  getKind: (time: number) => StripTick['kind'],
): StripTick[] {
  return times.map((time) => ({ time, x: getFraction(time, range), kind: getKind(time) }));
}

export function getStripTicks(range: TimeRange): StripTick[] {
  const span = range.end - range.start;
  if (span <= THREE_HOUR_TICK_MAX_MS) {
    return getTicks(range, getSteppedTimes(range, 3 * HOUR_MS), getTickKind);
  }
  if (span <= HALF_DAY_TICK_MAX_MS) {
    return getTicks(range, getSteppedTimes(range, 12 * HOUR_MS), getTickKind);
  }
  if (span <= DAY_TICK_MAX_MS) return getTicks(range, getSteppedTimes(range, DAY_MS), getTickKind);
  if (span <= WEEK_TICK_MAX_MS) {
    return getTicks(range, getSteppedTimes(range, WEEK_MS, MONDAY_OFFSET_MS), () => 'date');
  }
  return getTicks(range, getMonthStarts(range), () => 'month');
}

export function getAreaStrip({
  earthquakes,
  selected,
  range,
}: {
  earthquakes: readonly Earthquake[];
  selected: Earthquake;
  range: TimeRange;
}): AreaStrip {
  const dots = earthquakes
    .filter((earthquake) => earthquake !== selected)
    .toSorted((a, b) => a.magnitude - b.magnitude)
    .map(({ id, time, magnitude }) => ({
      id,
      x: getFraction(time, range),
      radius: getStripDotRadius(magnitude),
    }));
  const x = getFraction(selected.time, range);
  return {
    dots,
    selected: {
      x,
      radius: Math.max(STRIP_DOT_LOOK.selectedMinPx, getStripDotRadius(selected.magnitude)),
    },
    isLabelAtEnd: x > LABEL_END_FRACTION,
  };
}
