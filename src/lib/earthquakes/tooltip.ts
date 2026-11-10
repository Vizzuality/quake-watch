import { getDecimalLabel, getKmLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

import { getEarthquakeMeaning } from './meaning';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MINUTES_LIMIT_MS = HOUR_MS;
const HOURS_LIMIT_MS = 48 * HOUR_MS;

type DateParts = Record<'weekday' | 'day' | 'month' | 'hour' | 'minute', string>;

function getUtcDateParts(time: number, locale: Locale): DateParts {
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).formatToParts(time);
  const getPart = (type: keyof DateParts) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    weekday: getPart('weekday'),
    day: getPart('day'),
    month: getPart('month'),
    hour: getPart('hour'),
    minute: getPart('minute'),
  };
}

export function getTooltipAge(time: number, now: number, locale: Locale): string {
  const elapsedMs = Math.max(0, now - time);
  if (elapsedMs < MINUTES_LIMIT_MS) {
    const count = getDecimalLabel(Math.floor(elapsedMs / MINUTE_MS), locale);
    return m.tooltip_age_minutes({ count }, { locale });
  }
  if (elapsedMs < HOURS_LIMIT_MS) {
    const count = getDecimalLabel(Math.floor(elapsedMs / HOUR_MS), locale);
    return m.tooltip_age_hours({ count }, { locale });
  }
  const count = getDecimalLabel(Math.floor(elapsedMs / DAY_MS), locale);
  return m.tooltip_age_days({ count }, { locale });
}

export function getTooltipDate(time: number, locale: Locale): string {
  const { weekday, day, month, hour, minute } = getUtcDateParts(time, locale);
  return `${weekday} ${day}.${month} · ${hour}:${minute} UTC`;
}

export function getTooltipCompactMeta(time: number, depthKm: number, locale: Locale): string {
  const { weekday, day, hour, minute } = getUtcDateParts(time, locale);
  const depth = m.tooltip_depth_deep({ depth: getKmLabel(depthKm, locale) }, { locale });
  return `${weekday} ${day} · ${hour}:${minute} · ${depth}`;
}

export function getTooltipFelt(magnitude: number, depthKm: number, locale: Locale): string {
  const meaning = getEarthquakeMeaning({ magnitude, depthKm, distanceKm: null });
  if (meaning.kind !== 'felt-reach') return m.intensity_level_not_felt({}, { locale });
  return `~${getKmLabel(meaning.reachKm, locale)}`;
}

export function getTooltipMagnitude(magnitude: number, locale: Locale): string {
  const label = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(magnitude);
  return `M${label}`;
}
