import { stripSearchParams } from '@tanstack/react-router';
import { z } from 'zod';

export const SOURCES = ['emsc', 'usgs'] as const;
export const INTERVALS = ['24h', '3d', '7d'] as const;
export const MIN_MAGNITUDES = [0, 3, 4, 5, 6] as const;
export const DEPTHS = ['all', 'shallow', 'mid', 'deep'] as const;

export type EarthquakeSource = (typeof SOURCES)[number];
export type Interval = (typeof INTERVALS)[number];
export type MinMagnitude = (typeof MIN_MAGNITUDES)[number];
export type Depth = (typeof DEPTHS)[number];

export const DEPTH_RANGES_KM: Record<Exclude<Depth, 'all'>, { min?: number; max?: number }> = {
  shallow: { max: 70 },
  mid: { min: 70, max: 300 },
  deep: { min: 300 },
};

export const QUAKE_PATTERN = /^(emsc|usgs):[A-Za-z0-9_-]{1,64}$/;

const DAY_MS = 86_400_000;
const INTERVAL_MS: Record<Interval, number> = {
  '24h': DAY_MS,
  '3d': 3 * DAY_MS,
  '7d': 7 * DAY_MS,
};

export function getRoundedCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function getRoundedNumberSchema(min: number, max: number) {
  return z.number().min(min).max(max).transform(getRoundedCoordinate).optional().catch(undefined);
}

export const earthquakeSearchSchema = z.object({
  source: z.enum(SOURCES).default('emsc').catch('emsc'),
  place: z.string().trim().min(1).max(120).optional().catch(undefined),
  interval: z.enum(INTERVALS).default('7d').catch('7d'),
  minmag: z.literal(MIN_MAGNITUDES).default(0).catch(0),
  depth: z.enum(DEPTHS).default('all').catch('all'),
  quake: z.string().regex(QUAKE_PATTERN).optional().catch(undefined),
  lat: getRoundedNumberSchema(-90, 90),
  lon: getRoundedNumberSchema(-180, 180),
  zoom: getRoundedNumberSchema(0, 20),
});

export type EarthquakeSearch = z.infer<typeof earthquakeSearchSchema>;

export type EarthquakeFilters = Pick<EarthquakeSearch, 'source' | 'interval' | 'minmag' | 'depth'>;

export function getEarthquakeFilters({
  source,
  interval,
  minmag,
  depth,
}: EarthquakeFilters): EarthquakeFilters {
  return { source, interval, minmag, depth };
}

export const EARTHQUAKE_SEARCH_DEFAULTS = {
  source: 'emsc',
  interval: '7d',
  minmag: 0,
  depth: 'all',
} as const satisfies Partial<EarthquakeSearch>;

export const EARTHQUAKE_SEARCH_ROUTE = {
  validateSearch: earthquakeSearchSchema,
  search: { middlewares: [stripSearchParams<EarthquakeSearch>(EARTHQUAKE_SEARCH_DEFAULTS)] },
};

export function getIntervalStart(interval: Interval, now: Date): Date {
  return new Date(now.getTime() - INTERVAL_MS[interval]);
}
