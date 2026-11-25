import { getWaveLifeSeconds } from '@/lib/globe/felt-rings';
import { getIntlLocale } from '@/lib/i18n/intl-locale';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

import { getDepthColor } from './depth-color';
import type { TimeRange } from './timeline';
import { type TimeUnit, getPlaybackSpeed, getTimeUnit } from './timeline';
import type { Earthquake } from './types';

export type RingTick = {
  id: string;
  time: number;
  fraction: number;
  length: number;
  color: string;
  activeMs: number;
};
export type RingMark = { fraction: number; label: string | null };
export type RingBox = { left: number; top: number; right: number; bottom: number };
type Point = { x: number; y: number };

export const RING_OBSTACLE_SELECTOR = '[data-ring-obstacle]';

export const TIME_RING_LOOK = {
  radius: 354,
  gap: 0.07,
  barInset: 3,
  barBase: 3,
  barPerMagnitude: 10,
  barMagnitudeFloor: 3.6,
  barMax: 40,
  markLength: 8,
  activeBarWidth: 1.6,
  labelOffset: 64,
  labelEdgeFraction: 0.03,
  nowInner: 6,
  nowOuter: 8,
  nowLabelOffset: 19,
  needleInner: -6,
  needleOuter: 46,
  dotOffset: 46,
  dotRadius: 3,
  needleLabelGap: 18.6,
  needleLabelLine: 13,
  hitInner: 16,
  hitOuter: 78,
} as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30.44 * DAY_MS;
const MONDAY_OFFSET_MS = 4 * DAY_MS;
const HOURLY_MARK_STEP_MS = 3 * HOUR_MS;
const NEEDLE_WINDOW_MIN_MS = 2 * HOUR_MS;
const NEEDLE_WINDOW_FRACTION = 0.05;
const SCRUB_STEPS = 48;
const PAGE_STEPS = 6;
const FULL_TURN = Math.PI * 2;
const RING_FADE_START_ZOOM = 1;
const RING_FADE_SPAN_ZOOM = 0.08;
const RING_LABEL_CLEARANCE_PX = 8;

export function getRingFraction(time: number, range: TimeRange): number {
  const span = range.end - range.start;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (time - range.start) / span));
}

export function getRingAngle(fraction: number): number {
  const { gap } = TIME_RING_LOOK;
  return -Math.PI / 2 + gap / 2 + fraction * (FULL_TURN - gap);
}

export function getRingFractionAt(dx: number, dy: number): number {
  const { gap } = TIME_RING_LOOK;
  const angle = (((Math.atan2(dy, dx) + Math.PI / 2) % FULL_TURN) + FULL_TURN) % FULL_TURN;
  if (angle > FULL_TURN - gap / 2) return 1;
  return Math.min(1, Math.max(0, (angle - gap / 2) / (FULL_TURN - gap)));
}

export function getRingPoint(angle: number, radius: number): Point {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export function getRingBarLength(magnitude: number): number {
  const { barBase, barPerMagnitude, barMagnitudeFloor, barMax } = TIME_RING_LOOK;
  const length = barBase + Math.max(0, magnitude - barMagnitudeFloor) * barPerMagnitude;
  return Math.min(barMax, Number.isNaN(length) ? barBase : length);
}

export function getRingTicks(earthquakes: readonly Earthquake[], range: TimeRange): RingTick[] {
  const playbackSpeed = getPlaybackSpeed(range);
  return earthquakes
    .filter(({ time }) => time >= range.start && time <= range.end)
    .map(({ id, time, magnitude, depthKm }) => ({
      id,
      time,
      fraction: getRingFraction(time, range),
      length: getRingBarLength(magnitude),
      color: getDepthColor(depthKm),
      activeMs: getWaveLifeSeconds(magnitude) * 1000 * playbackSpeed,
    }));
}

export function getActiveRingTicks(ticks: readonly RingTick[], playhead: number): RingTick[] {
  return ticks.filter(({ time, activeMs }) => time <= playhead && playhead - time <= activeMs);
}

export function getRingBarPath({
  fraction,
  length,
}: Pick<RingTick, 'fraction' | 'length'>): string {
  const inner = TIME_RING_LOOK.radius + TIME_RING_LOOK.barInset;
  const angle = getRingAngle(fraction);
  const from = getRingPoint(angle, inner);
  const to = getRingPoint(angle, inner + length);
  return `M${from.x.toFixed(1)} ${from.y.toFixed(1)}L${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

export function getRingBarsPath(ticks: readonly RingTick[]): string {
  return ticks.map(getRingBarPath).join('');
}

export function getPastWedgePath(fraction: number, radius: number): string {
  if (fraction <= 0) return 'M0 0Z';
  const startAngle = getRingAngle(0);
  const endAngle = getRingAngle(Math.min(1, fraction));
  const from = getRingPoint(startAngle, radius);
  const to = getRingPoint(endAngle, radius);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M0 0L${from.x.toFixed(2)} ${from.y.toFixed(2)}A${radius} ${radius} 0 ${largeArc} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}Z`;
}

function getUtcParts(time: number, locale: Locale) {
  const parts = new Intl.DateTimeFormat(getIntlLocale(locale), {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).formatToParts(time);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value.replace('.', '') ?? '';
  return {
    weekday: getPart('weekday'),
    day: getPart('day'),
    month: getPart('month'),
    hour: getPart('hour'),
  };
}

function getSteppedTimes(range: TimeRange, stepMs: number, offsetMs = 0): number[] {
  const times: number[] = [];
  const first = Math.ceil((range.start - offsetMs) / stepMs) * stepMs + offsetMs;
  for (let time = first; time <= range.end; time += stepMs) times.push(time);
  return times;
}

function getMonthTimes(range: TimeRange): number[] {
  const times: number[] = [];
  const date = new Date(range.start);
  let time = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  if (time < range.start) time = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  while (time <= range.end) {
    times.push(time);
    const next = new Date(time);
    time = Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1);
  }
  return times;
}

function getMarkTimes(range: TimeRange, unit: TimeUnit): number[] {
  if (unit === 'hour') return getSteppedTimes(range, HOURLY_MARK_STEP_MS);
  if (unit === 'day') return getSteppedTimes(range, DAY_MS);
  if (unit === 'week') return getSteppedTimes(range, WEEK_MS, MONDAY_OFFSET_MS);
  return getMonthTimes(range);
}

function getMarkLabel(time: number, unit: TimeUnit, locale: Locale): string {
  const { weekday, day, month, hour } = getUtcParts(time, locale);
  if (unit === 'hour') return `${hour}:00`;
  if (unit === 'day') return `${weekday} ${day}`;
  if (unit === 'week') return `${day} ${month}`;
  return month;
}

function isLabelled(fraction: number): boolean {
  const edge = TIME_RING_LOOK.labelEdgeFraction;
  return fraction > edge && fraction < 1 - edge;
}

export function getRingMarks(range: TimeRange, locale: Locale): RingMark[] {
  const unit = getTimeUnit(range);
  return getMarkTimes(range, unit).map((time) => {
    const fraction = getRingFraction(time, range);
    const label = isLabelled(fraction) ? getMarkLabel(time, unit, locale) : null;
    return { fraction, label };
  });
}

const SPEED_UNITS: Record<
  TimeUnit,
  {
    ms: number;
    message: (inputs: { seconds: number }, options: { locale: Locale }) => string;
  }
> = {
  hour: { ms: HOUR_MS, message: m.timeline_speed_hour },
  day: { ms: DAY_MS, message: m.timeline_speed_day },
  week: { ms: WEEK_MS, message: m.timeline_speed_week },
  month: { ms: MONTH_MS, message: m.timeline_speed_month },
};

export function getSpeedLabel(range: TimeRange, locale: Locale): string {
  const msPerSecond = getPlaybackSpeed(range) * 1000;
  const { ms, message } = SPEED_UNITS[getTimeUnit(range)];
  const seconds = Math.max(1, Math.round(ms / msPerSecond));
  return message({ seconds }, { locale });
}

export function getScrubStepMs(range: TimeRange): number {
  return (range.end - range.start) / SCRUB_STEPS;
}

export function getRingKeyTarget(key: string, current: number, range: TimeRange): number | null {
  const step = getScrubStepMs(range);
  const targets: Record<string, number> = {
    ArrowRight: current + step,
    ArrowUp: current + step,
    ArrowLeft: current - step,
    ArrowDown: current - step,
    PageUp: current + step * PAGE_STEPS,
    PageDown: current - step * PAGE_STEPS,
    Home: range.start,
    End: range.end,
  };
  return targets[key] ?? null;
}

export function getNeedleEarthquake(
  earthquakes: readonly Earthquake[],
  playhead: number,
  range: TimeRange,
): Earthquake | undefined {
  const windowMs = Math.max(
    NEEDLE_WINDOW_MIN_MS,
    (range.end - range.start) * NEEDLE_WINDOW_FRACTION,
  );
  let largest: Earthquake | undefined;
  for (const earthquake of earthquakes) {
    const age = playhead - earthquake.time;
    if (age < 0 || age > windowMs) continue;
    if (!largest || earthquake.magnitude > largest.magnitude) largest = earthquake;
  }
  return largest;
}

export function getRingOpacity(zoom: number | undefined): number {
  if (zoom === undefined) return 1;
  return Math.min(1, Math.max(0, 1 - (zoom - RING_FADE_START_ZOOM) / RING_FADE_SPAN_ZOOM));
}

function isOverlapping(label: RingBox, obstacle: RingBox, gap: number): boolean {
  return (
    label.left < obstacle.right + gap &&
    label.right > obstacle.left - gap &&
    label.top < obstacle.bottom + gap &&
    label.bottom > obstacle.top - gap
  );
}

export function isRingLabelBlocked(label: RingBox, obstacles: readonly RingBox[]): boolean {
  return obstacles.some((obstacle) => isOverlapping(label, obstacle, RING_LABEL_CLEARANCE_PX));
}
