import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

import type { EarthquakeDetail } from './details/query-options';
import { DEPTH_RANGES_KM } from './search-schema';
import type { Earthquake } from './types';

export const DEPTH_SCALE_KM = 700;

export type DepthClass = 'shallow' | 'intermediate' | 'deep';

export type EarthquakePosition = {
  index: number;
  total: number;
  previous: Earthquake | null;
  next: Earthquake | null;
};

type MessageOptions = { locale: Locale };
type Message = (inputs: Record<string, never>, options: MessageOptions) => string;

const DEPTH_CLASS_LABELS: Record<DepthClass, Message> = {
  shallow: m.details_depth_shallow,
  intermediate: m.details_depth_intermediate,
  deep: m.details_depth_deep,
};

const MAGNITUDE_TYPE_LABELS: Record<string, Message> = {
  mw: m.details_magtype_moment,
  mb: m.details_magtype_body,
  ml: m.details_magtype_local,
  ms: m.details_magtype_surface,
  md: m.details_magtype_duration,
};

export function getTimeOrderedEarthquakes(earthquakes: readonly Earthquake[]): Earthquake[] {
  return [...earthquakes].sort((a, b) => a.time - b.time);
}

export function getEarthquakePosition(
  ordered: readonly Earthquake[],
  quake: string,
): EarthquakePosition | null {
  const index = ordered.findIndex(({ source, id }) => `${source}:${id}` === quake);
  if (index === -1) return null;
  return {
    index: index + 1,
    total: ordered.length,
    previous: ordered[index - 1] ?? null,
    next: ordered[index + 1] ?? null,
  };
}

export function getPositionLabel({ index, total }: EarthquakePosition, locale: Locale): string {
  const width = String(total).length;
  return m.details_position(
    { index: String(index).padStart(width, '0'), total: String(total) },
    { locale },
  );
}

export function getDepthClass(depthKm: number): DepthClass {
  if (depthKm < (DEPTH_RANGES_KM.shallow.max ?? 0)) return 'shallow';
  if (depthKm < (DEPTH_RANGES_KM.mid.max ?? 0)) return 'intermediate';
  return 'deep';
}

export function getDepthClassLabel(depthKm: number, locale: Locale): string {
  return DEPTH_CLASS_LABELS[getDepthClass(depthKm)]({}, { locale });
}

export function getDepthScaleFraction(depthKm: number): number {
  return Math.min(DEPTH_SCALE_KM, Math.max(0, depthKm)) / DEPTH_SCALE_KM;
}

export function getMagnitudeValueLabel(magnitude: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(magnitude);
}

export function getMagnitudeTypeCaption(magnitudeType: string, locale: Locale): string {
  const label = MAGNITUDE_TYPE_LABELS[magnitudeType.slice(0, 2).toLowerCase()];
  return (label ?? m.details_magtype_other)({}, { locale });
}

export function getDetailsDate(time: number, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).formatToParts(time);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const date = `${getPart('weekday')} ${getPart('day')}.${getPart('month')}.${getPart('year')}`;
  return `${date} · ≈ ${getPart('hour')}:${getPart('minute')} UTC`;
}

export function getFeltReports(detail: EarthquakeDetail | null | undefined): number | null {
  if (detail?.source !== 'usgs') return null;
  return detail.detail.impact?.dyfiResponses ?? null;
}
