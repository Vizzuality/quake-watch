import { z } from 'zod';

import { DEPTH_RANGES_KM, getIntervalStart } from '../search-schema';
import type { EarthquakeFilters } from '../search-schema';
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
  getQueryUrl(filters: EarthquakeFilters, now: Date, limit: number): string;
  getEarthquake(feature: unknown): Earthquake | null;
};

export function getFeatures(json: unknown): unknown[] {
  return featureCollectionSchema.parse(json).features;
}

export function getFdsnQueryParams(
  { interval, minmag, depth }: EarthquakeFilters,
  now: Date,
  limit: number,
): URLSearchParams {
  const params = new URLSearchParams({
    orderby: 'time',
    limit: String(limit),
    minmagnitude: String(minmag),
    starttime: getIntervalStart(interval, now).toISOString(),
  });
  if (depth === 'all') return params;
  const { min, max } = DEPTH_RANGES_KM[depth];
  if (min !== undefined) params.set('mindepth', String(min));
  if (max !== undefined) params.set('maxdepth', String(max));
  return params;
}
