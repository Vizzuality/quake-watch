import { stripSearchParams } from '@tanstack/react-router';
import { z } from 'zod';

export const SOURCES = ['emsc', 'usgs'] as const;
export const SOURCE_FILTERS = ['emsc', 'usgs', 'all'] as const;
export const INTERVALS = ['24h', '3d', '7d', '1y', 'custom'] as const;
export const MIN_MAGNITUDES = [0, 3, 4, 5, 6] as const;
export const DEPTHS = ['all', 'shallow', 'mid', 'deep'] as const;
export const DETAIL_VIEWS = ['map', 'section'] as const;
export const SEARCH_RADII_KM = [50, 100, 250, 500] as const;
export const DEFAULT_SEARCH_RADIUS_KM = 100;

export type EarthquakeSource = (typeof SOURCES)[number];
export type SourceFilter = (typeof SOURCE_FILTERS)[number];
export type Interval = (typeof INTERVALS)[number];
export type RelativeInterval = Exclude<Interval, 'custom'>;
export type TimeWindow = { start: number; end: number };
export type MinMagnitude = (typeof MIN_MAGNITUDES)[number];
export type Depth = (typeof DEPTHS)[number];
export type DetailView = (typeof DETAIL_VIEWS)[number];
export type SearchRadiusKm = (typeof SEARCH_RADII_KM)[number];

export const DEPTH_RANGES_KM: Record<Exclude<Depth, 'all'>, { min?: number; max?: number }> = {
  shallow: { max: 70 },
  mid: { min: 70, max: 300 },
  deep: { min: 300 },
};

export const QUAKE_PATTERN = /^(emsc|usgs):[A-Za-z0-9_-]{1,64}$/;

export const DAY_MS = 86_400_000;
export const CUSTOM_MAX_DAYS = 366;
export const CUSTOM_DEFAULT_DAYS = 30;
const INTERVAL_MS: Record<RelativeInterval, number> = {
  '24h': DAY_MS,
  '3d': 3 * DAY_MS,
  '7d': 7 * DAY_MS,
  '1y': 365 * DAY_MS,
};
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getRoundedCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function getRoundedNumberSchema(min: number, max: number) {
  return z.number().min(min).max(max).transform(getRoundedCoordinate).optional().catch(undefined);
}

export function getDateStart(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

export function getIsoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function isIsoDate(date: string | undefined): date is string {
  if (!date || !ISO_DATE_PATTERN.test(date)) return false;
  const time = getDateStart(date);
  return !Number.isNaN(time) && getIsoDate(time) === date;
}

export type CustomRangeError = 'missing' | 'order' | 'future' | 'span';

export function getCustomRangeError(
  from: string | undefined,
  to: string | undefined,
  now: number,
): CustomRangeError | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return 'missing';
  const start = getDateStart(from);
  const end = getDateStart(to);
  if (start > end) return 'order';
  if (end > getDateStart(getIsoDate(now))) return 'future';
  if ((end - start) / DAY_MS + 1 > CUSTOM_MAX_DAYS) return 'span';
  return null;
}

function getValidatedRange<T extends { interval: Interval; from?: string; to?: string }>(
  search: T,
): T {
  if (search.interval !== 'custom') return { ...search, from: undefined, to: undefined };
  if (getCustomRangeError(search.from, search.to, Date.now()) === null) return search;
  return { ...search, interval: '7d', from: undefined, to: undefined };
}

function getValidatedArea<T extends { place?: string; plat?: number; plon?: number }>(
  search: T,
): T {
  if (search.plat !== undefined && search.plon !== undefined) return search;
  return { ...search, place: undefined, plat: undefined, plon: undefined };
}

function getValidatedSearch<
  T extends { interval: Interval; from?: string; to?: string; plat?: number; plon?: number },
>(search: T): T {
  return getValidatedArea(getValidatedRange(search));
}

export const earthquakeSearchFieldsSchema = z.object({
  source: z.enum(SOURCE_FILTERS).default('emsc').catch('emsc'),
  place: z.string().trim().min(1).max(120).optional().catch(undefined),
  plat: getRoundedNumberSchema(-90, 90),
  plon: getRoundedNumberSchema(-180, 180),
  radius: z
    .literal(SEARCH_RADII_KM)
    .default(DEFAULT_SEARCH_RADIUS_KM)
    .catch(DEFAULT_SEARCH_RADIUS_KM),
  interval: z.enum(INTERVALS).default('7d').catch('7d'),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  minmag: z.literal(MIN_MAGNITUDES).default(0).catch(0),
  depth: z.enum(DEPTHS).default('all').catch('all'),
  quake: z.string().regex(QUAKE_PATTERN).optional().catch(undefined),
  lat: getRoundedNumberSchema(-90, 90),
  lon: getRoundedNumberSchema(-180, 180),
  zoom: getRoundedNumberSchema(0, 20),
  view: z.enum(DETAIL_VIEWS).default('map').catch('map'),
});

export const earthquakeSearchSchema = earthquakeSearchFieldsSchema.transform(getValidatedSearch);

export type EarthquakeSearch = z.infer<typeof earthquakeSearchSchema>;

export type EarthquakeFilters = Pick<
  EarthquakeSearch,
  'source' | 'interval' | 'minmag' | 'depth' | 'from' | 'to'
>;

export type TimeFilters = Pick<EarthquakeFilters, 'interval' | 'from' | 'to'>;

export function getEarthquakeFilters({
  source,
  interval,
  minmag,
  depth,
  from,
  to,
}: EarthquakeFilters): EarthquakeFilters {
  const filters = { source, interval, minmag, depth };
  return interval === 'custom' ? { ...filters, from, to } : filters;
}

export const EARTHQUAKE_SEARCH_DEFAULTS = {
  source: 'emsc',
  interval: '7d',
  minmag: 0,
  depth: 'all',
  radius: DEFAULT_SEARCH_RADIUS_KM,
  view: 'map',
} as const satisfies Partial<EarthquakeSearch>;

export const EARTHQUAKE_SEARCH_ROUTE = {
  validateSearch: earthquakeSearchSchema,
  search: { middlewares: [stripSearchParams<EarthquakeSearch>(EARTHQUAKE_SEARCH_DEFAULTS)] },
};

export function getTimeWindow({ interval, from, to }: TimeFilters, now: number): TimeWindow {
  if (interval !== 'custom') return { start: now - INTERVAL_MS[interval], end: now };
  const start = getDateStart(from ?? getIsoDate(now));
  const end = getDateStart(to ?? getIsoDate(now)) + DAY_MS;
  return { start, end: Math.min(end, now) };
}

export function getDefaultCustomRange(now: number): { from: string; to: string } {
  return {
    from: getIsoDate(now - (CUSTOM_DEFAULT_DAYS - 1) * DAY_MS),
    to: getIsoDate(now),
  };
}
