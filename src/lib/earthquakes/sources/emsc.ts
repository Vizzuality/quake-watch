import { z } from 'zod';

import { getSearchCenter, getTimeRange } from '../search-schema';
import type { EarthquakeSearch } from '../search-schema';
import type { Earthquake } from '../types';
import { coordinatesSchema } from './feature-collection';
import type { SourceAdapter } from './feature-collection';

export const EMSC_QUERY_URL = 'https://www.seismicportal.eu/fdsnws/event/1/query';
const EMSC_EVENT_URL = 'https://www.seismicportal.eu/eventdetails.html';
const KM_PER_DEGREE = 111.195;

export const emscFeatureSchema = z.object({
  id: z.string(),
  geometry: z.object({ coordinates: coordinatesSchema }),
  properties: z.object({
    unid: z.string(),
    time: z.iso.datetime(),
    flynn_region: z.string().nullish(),
    depth: z.number(),
    mag: z.number(),
    magtype: z.string().nullish(),
  }),
});

function getRegionLabel(region: string | null | undefined): string | null {
  if (!region) return null;
  return region
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getQueryUrl(search: EarthquakeSearch, now: Date, limit: number): string {
  const { start, end } = getTimeRange(search, now);
  const params = new URLSearchParams({
    format: 'json',
    orderby: 'time',
    limit: String(limit),
    minmag: String(search.minmag),
    start: start.toISOString(),
  });
  if (end) params.set('end', end.toISOString());
  const center = getSearchCenter(search);
  if (center) {
    params.set('lat', String(center.latitude));
    params.set('lon', String(center.longitude));
    params.set('maxradius', String(search.radius / KM_PER_DEGREE));
  }
  return `${EMSC_QUERY_URL}?${params}`;
}

export function getEarthquake(feature: unknown): Earthquake | null {
  const result = emscFeatureSchema.safeParse(feature);
  if (!result.success) return null;
  const { geometry, properties } = result.data;
  const [longitude, latitude] = geometry.coordinates;
  return {
    id: properties.unid,
    source: 'emsc',
    magnitude: properties.mag,
    magnitudeType: properties.magtype ?? null,
    place: getRegionLabel(properties.flynn_region),
    time: Date.parse(properties.time),
    depthKm: properties.depth,
    longitude,
    latitude,
    url: `${EMSC_EVENT_URL}?unid=${encodeURIComponent(properties.unid)}`,
  };
}

export const emscAdapter: SourceAdapter = { label: 'EMSC', getQueryUrl, getEarthquake };
