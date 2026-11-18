import { getIntlLocale } from '@/lib/i18n/intl-locale';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

import type { TimeRange } from './timeline';
import { getPlaybackSpeed } from './timeline';
import type { Earthquake } from './types';

export type RingTick = { id: string; time: number; fraction: number; length: number };
export type RingMark = { fraction: number; label: string | null };
type Point = { x: number; y: number };

export const TIME_RING_LOOK = {
  radius: 354,
  gap: 0.07,
  barInset: 3,
  barBase: 3,
  barPerMagnitude: 10,
  barMagnitudeFloor: 3.6,
  barMax: 40,
  markLength: 8,
  labelOffset: 64,
  labelEdgeFraction: 0.03,
  nowInner: 6,
  nowOuter: 8,
  nowLabelOffset: 19,
  needleInner: 1,
  needleOuter: 41,
  dotOffset: 47,
  dotRadius: 3,
  needleLabelGap: 18.6,
  needleLabelLine: 13,
  hitInner: 16,
  hitOuter: 78,
} as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const HOURLY_LABEL_SPAN_MS = 30 * HOUR_MS;
const HOURLY_MARK_STEP_MS = 3 * HOUR_MS;
const NEEDLE_WINDOW_MIN_MS = 2 * HOUR_MS;
const NEEDLE_WINDOW_FRACTION = 0.05;
const SCRUB_STEPS = 48;
const FULL_TURN = Math.PI * 2;
const RING_FADE_START_ZOOM = 1.08;
const RING_FADE_SPAN_ZOOM = 0.4;

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
  return earthquakes
    .filter(({ time }) => time >= range.start && time <= range.end)
    .map(({ id, time, magnitude }) => ({
      id,
      time,
      fraction: getRingFraction(time, range),
      length: getRingBarLength(magnitude),
    }));
}

export function getRingBarsPath(ticks: readonly RingTick[]): string {
  const inner = TIME_RING_LOOK.radius + TIME_RING_LOOK.barInset;
  return ticks
    .map(({ fraction, length }) => {
      const angle = getRingAngle(fraction);
      const from = getRingPoint(angle, inner);
      const to = getRingPoint(angle, inner + length);
      return `M${from.x.toFixed(1)} ${from.y.toFixed(1)}L${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    })
    .join('');
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
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).formatToParts(time);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    weekday: getPart('weekday').replace('.', ''),
    day: getPart('day'),
    hour: getPart('hour'),
  };
}

function getMarkTimes(range: TimeRange, stepMs: number): number[] {
  const times: number[] = [];
  for (let time = Math.ceil(range.start / stepMs) * stepMs; time <= range.end; time += stepMs) {
    times.push(time);
  }
  return times;
}

function getMarkLabel(time: number, isHourly: boolean, locale: Locale): string {
  const { weekday, day, hour } = getUtcParts(time, locale);
  return isHourly ? `${hour}:00` : `${weekday} ${day}`;
}

function isLabelled(fraction: number): boolean {
  const edge = TIME_RING_LOOK.labelEdgeFraction;
  return fraction > edge && fraction < 1 - edge;
}

export function getRingMarks(range: TimeRange, locale: Locale): RingMark[] {
  const isHourly = range.end - range.start <= HOURLY_LABEL_SPAN_MS;
  const stepMs = isHourly ? HOURLY_MARK_STEP_MS : DAY_MS;
  return getMarkTimes(range, stepMs).map((time) => {
    const fraction = getRingFraction(time, range);
    const label = isLabelled(fraction) ? getMarkLabel(time, isHourly, locale) : null;
    return { fraction, label };
  });
}

export function getSpeedLabel(range: TimeRange, locale: Locale): string {
  const msPerSecond = getPlaybackSpeed(range) * 1000;
  if (range.end - range.start <= HOURLY_LABEL_SPAN_MS) {
    const seconds = Math.max(1, Math.round(HOUR_MS / msPerSecond));
    return m.timeline_speed_hour({ seconds }, { locale });
  }
  const seconds = Math.max(1, Math.round(DAY_MS / msPerSecond));
  return m.timeline_speed_day({ seconds }, { locale });
}

export function getScrubStepMs(range: TimeRange): number {
  return (range.end - range.start) / SCRUB_STEPS;
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
