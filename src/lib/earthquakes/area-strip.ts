import { getFeltReachKm } from './intensity';
import type { Interval } from './search-schema';
import { getDistanceKm } from './sequences';
import type { TimeRange } from './timeline';
import type { Earthquake } from './types';

export const AREA_MIN_RADIUS_KM = 300;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const TICK_STEP_MS: Record<Interval, number> = {
  '24h': 3 * HOUR_MS,
  '3d': 12 * HOUR_MS,
  '7d': DAY_MS,
};
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

export type StripTick = { time: number; x: number; kind: 'day' | 'hour' };
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

export function getStripTicks(range: TimeRange, interval: Interval): StripTick[] {
  const step = TICK_STEP_MS[interval];
  const ticks: StripTick[] = [];
  for (let time = Math.ceil(range.start / step) * step; time <= range.end; time += step) {
    ticks.push({ time, x: getFraction(time, range), kind: getTickKind(time) });
  }
  return ticks;
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
