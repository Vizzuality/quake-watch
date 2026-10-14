import { z } from 'zod';

import { EarthquakeSourceError } from '../query-options';
import { EMSC_QUERY_URL, emscFeatureSchema, getEarthquake } from '../sources/emsc';
import type { Earthquake } from '../types';

const emscDetailSchema = emscFeatureSchema.extend({
  properties: emscFeatureSchema.shape.properties.extend({
    auth: z.string().nullish(),
    source_catalog: z.string().nullish(),
    lastupdate: z.string().nullish(),
  }),
});

export type EmscEarthquakeDetail = {
  earthquake: Earthquake;
  author: string | null;
  sourceCatalog: string | null;
  flynnRegion: string | null;
  lastUpdate: number | null;
};

function getTimestamp(value: string | null | undefined): number | null {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function getEmscEarthquakeDetailFromFeature(feature: unknown): EmscEarthquakeDetail | null {
  const result = emscDetailSchema.safeParse(feature);
  if (!result.success) return null;
  const earthquake = getEarthquake(result.data);
  if (!earthquake) return null;
  const { properties } = result.data;
  return {
    earthquake,
    author: properties.auth ?? null,
    sourceCatalog: properties.source_catalog ?? null,
    flynnRegion: properties.flynn_region ?? null,
    lastUpdate: getTimestamp(properties.lastupdate),
  };
}

export async function getEmscEarthquakeDetail(
  id: string,
  signal?: AbortSignal,
): Promise<EmscEarthquakeDetail | null> {
  const params = new URLSearchParams({ eventid: id, format: 'json' });
  const response = await fetch(`${EMSC_QUERY_URL}?${params}`, { signal });
  if (response.status === 204) return null;
  if (!response.ok) throw new EarthquakeSourceError('emsc', response.status);
  const detail = getEmscEarthquakeDetailFromFeature(await response.json());
  if (!detail) throw new EarthquakeSourceError('emsc', response.status);
  return detail;
}
