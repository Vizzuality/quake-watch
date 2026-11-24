import { z } from 'zod';

import { DEPTH_RANGES_KM, getTimeWindow } from '../search-schema';
import type { EarthquakeFilters, TimeWindow } from '../search-schema';
import type { Earthquake } from '../types';

const featureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(z.unknown()),
});

export const coordinatesSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
  z.number(),
]);

export type SourceAdapter = {
  label: string;
  getQueryUrl(filters: EarthquakeFilters, query: FdsnQuery): string;
  getEarthquake(feature: unknown): Earthquake | null;
};

export function getFeatures(json: unknown): unknown[] {
  return featureCollectionSchema.parse(json).features;
}

export type FdsnQuery = { window: TimeWindow; limit: number; orderBy: 'time' | 'magnitude' };

export const LIVE_LIMIT = 20_000;
export const LONG_WINDOW_LIMIT = 5000;
export const LONG_WINDOW_MIN_MS = 8 * 86_400_000;

export function isLongWindow(window: TimeWindow): boolean {
  return window.end - window.start >= LONG_WINDOW_MIN_MS;
}

export function getFdsnQuery(filters: EarthquakeFilters, now: number): FdsnQuery {
  const window = getTimeWindow(filters, now);
  if (!isLongWindow(window)) {
    return { window, limit: LIVE_LIMIT, orderBy: 'time' };
  }
  return { window, limit: LONG_WINDOW_LIMIT, orderBy: 'magnitude' };
}

export function getFdsnQueryParams(
  { interval, minmag, depth }: EarthquakeFilters,
  { window, limit, orderBy }: FdsnQuery,
): URLSearchParams {
  const params = new URLSearchParams({
    orderby: orderBy,
    limit: String(limit),
    minmagnitude: String(minmag),
    starttime: new Date(window.start).toISOString(),
  });
  if (interval === 'custom') params.set('endtime', new Date(window.end).toISOString());
  if (depth === 'all') return params;
  const { min, max } = DEPTH_RANGES_KM[depth];
  if (min !== undefined) params.set('mindepth', String(min));
  if (max !== undefined) params.set('maxdepth', String(max));
  return params;
}
