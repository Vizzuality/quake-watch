import { EARTH_RADIUS_KM } from '@/lib/globe/quakes';
import { getIntlLocale } from '@/lib/i18n/intl-locale';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

import { getTooltipMagnitude } from './tooltip';
import type { Earthquake } from './types';

export type SequenceRole = 'main' | 'fore' | 'after' | 'doublet';

export type SequenceMember = { earthquake: Earthquake; role: SequenceRole };

export type Sequence = { main: Earthquake; members: SequenceMember[] };

export const DISTANCE_WINDOW_KM_BASE = 0.983;
export const DISTANCE_WINDOW_KM_SLOPE = 0.1238;
export const TIME_WINDOW_DAYS_BASE = -0.547;
export const TIME_WINDOW_DAYS_SLOPE = 0.5409;
export const LARGE_TIME_WINDOW_MAGNITUDE = 6.5;
export const LARGE_TIME_WINDOW_DAYS_BASE = 2.7389;
export const LARGE_TIME_WINDOW_DAYS_SLOPE = 0.032;
export const DOUBLET_MAGNITUDE_GAP = 0.05;

const DAY_MS = 86_400_000;
const MAX_SEQUENCE_ROWS = 3;
const RADIANS_PER_DEGREE = Math.PI / 180;
const KM_PER_DEGREE_LATITUDE = EARTH_RADIUS_KM * RADIANS_PER_DEGREE;

export function getDistanceWindowKm(magnitude: number): number {
  return 10 ** (DISTANCE_WINDOW_KM_SLOPE * magnitude + DISTANCE_WINDOW_KM_BASE);
}

export function getTimeWindowMs(magnitude: number): number {
  if (magnitude >= LARGE_TIME_WINDOW_MAGNITUDE) {
    return 10 ** (LARGE_TIME_WINDOW_DAYS_SLOPE * magnitude + LARGE_TIME_WINDOW_DAYS_BASE) * DAY_MS;
  }
  return 10 ** (TIME_WINDOW_DAYS_SLOPE * magnitude + TIME_WINDOW_DAYS_BASE) * DAY_MS;
}

export function getDistanceKm(a: Earthquake, b: Earthquake): number {
  const dLat = (b.latitude - a.latitude) * RADIANS_PER_DEGREE;
  const dLon = (b.longitude - a.longitude) * RADIANS_PER_DEGREE;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * RADIANS_PER_DEGREE) *
      Math.cos(b.latitude * RADIANS_PER_DEGREE) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isEqualSize(main: Earthquake, other: Earthquake): boolean {
  return Math.round((main.magnitude - other.magnitude) * 100) <= DOUBLET_MAGNITUDE_GAP * 100;
}

function getRole(main: Earthquake, earthquake: Earthquake): SequenceRole {
  if (earthquake === main) return 'main';
  if (earthquake.time < main.time) return 'fore';
  if (isEqualSize(main, earthquake)) return 'doublet';
  return 'after';
}

function isInWindow(main: Earthquake, other: Earthquake, radiusKm: number, spanMs: number) {
  if (Math.abs(other.time - main.time) > spanMs) return false;
  if (Math.abs(other.latitude - main.latitude) * KM_PER_DEGREE_LATITUDE > radiusKm) return false;
  return getDistanceKm(main, other) <= radiusKm;
}

export function getSequences(earthquakes: readonly Earthquake[]): Sequence[] {
  const bySize = [...earthquakes].sort((a, b) => b.magnitude - a.magnitude || a.time - b.time);
  const assigned = new Set<Earthquake>();
  const sequences: Sequence[] = [];
  for (const main of bySize) {
    if (assigned.has(main)) continue;
    const radiusKm = getDistanceWindowKm(main.magnitude);
    const spanMs = getTimeWindowMs(main.magnitude);
    const group = bySize.filter(
      (other) =>
        other === main || (!assigned.has(other) && isInWindow(main, other, radiusKm, spanMs)),
    );
    for (const earthquake of group) assigned.add(earthquake);
    const members = group
      .sort((a, b) => a.time - b.time)
      .map((earthquake) => ({ earthquake, role: getRole(main, earthquake) }));
    sequences.push({ main, members });
  }
  return sequences;
}

export function getSequenceOf(
  sequences: readonly Sequence[],
  earthquake: Earthquake,
): Sequence | null {
  return (
    sequences.find(({ members }) => members.some((member) => member.earthquake === earthquake)) ??
    null
  );
}

export function getSequenceRows(
  { members }: Sequence,
  selected: Earthquake,
  limit = MAX_SEQUENCE_ROWS,
): SequenceMember[] {
  const bySize = [...members].sort(
    (a, b) =>
      b.earthquake.magnitude - a.earthquake.magnitude || a.earthquake.time - b.earthquake.time,
  );
  const top = bySize.slice(0, limit);
  if (top.some(({ earthquake }) => earthquake === selected)) return top;
  const selectedMember = bySize.find(({ earthquake }) => earthquake === selected);
  if (!selectedMember) return top;
  return [...top.slice(0, limit - 1), selectedMember];
}

function getSequenceDate(time: number, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(getIntlLocale(locale), {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).formatToParts(time);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${getPart('weekday')} ${getPart('day')}.${getPart('month')}`;
}

function getLargestBlurb(count: number, locale: Locale): string {
  const formatted = new Intl.NumberFormat(getIntlLocale(locale)).format(count);
  const isOne = new Intl.PluralRules(getIntlLocale(locale)).select(count) === 'one';
  return isOne
    ? m.details_sequence_largest_one({ count: formatted }, { locale })
    : m.details_sequence_largest_other({ count: formatted }, { locale });
}

const RELATIVE_BLURBS: Record<Exclude<SequenceRole, 'main'>, typeof m.details_sequence_fore> = {
  fore: m.details_sequence_fore,
  after: m.details_sequence_after,
  doublet: m.details_sequence_doublet,
};

export function getSequenceBlurb(
  sequence: Sequence | null,
  selected: Earthquake,
  locale: Locale,
): string {
  if (!sequence || sequence.members.length < 2) return m.details_sequence_none({}, { locale });
  const role = sequence.members.find(({ earthquake }) => earthquake === selected)?.role ?? 'main';
  if (role === 'main') return getLargestBlurb(sequence.members.length - 1, locale);
  const { main } = sequence;
  return RELATIVE_BLURBS[role](
    {
      magnitude: getTooltipMagnitude(main.magnitude, locale),
      date: getSequenceDate(main.time, locale),
    },
    { locale },
  );
}

const ROLE_LABELS: Record<SequenceRole, typeof m.details_role_largest> = {
  main: m.details_role_largest,
  fore: m.details_role_before,
  after: m.details_role_after,
  doublet: m.details_role_equal,
};

export function getSequenceRoleLabel(
  { earthquake, role }: SequenceMember,
  selected: Earthquake,
  locale: Locale,
): string {
  if (earthquake === selected) return m.details_role_selected({}, { locale });
  return ROLE_LABELS[role]({}, { locale });
}
