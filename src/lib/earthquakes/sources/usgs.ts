import { z } from 'zod';

import type { EarthquakeFilters } from '../search-schema';
import type { Earthquake } from '../types';
import { coordinatesSchema, getFdsnQueryParams } from './feature-collection';
import type { SourceAdapter } from './feature-collection';

export const USGS_QUERY_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

const usgsFeatureSchema = z.object({
  id: z.string(),
  geometry: z.object({ coordinates: coordinatesSchema }),
  properties: z.object({
    mag: z.number(),
    magType: z.string().nullish(),
    place: z.string().nullish(),
    time: z.number(),
    url: z.url({ protocol: /^https$/ }),
  }),
});

function getQueryUrl(filters: EarthquakeFilters, now: Date, limit: number): string {
  const params = new URLSearchParams([
    ['format', 'geojson'],
    ...getFdsnQueryParams(filters, now, limit),
  ]);
  return `${USGS_QUERY_URL}?${params}`;
}

function getEarthquake(feature: unknown): Earthquake | null {
  const result = usgsFeatureSchema.safeParse(feature);
  if (!result.success) return null;
  const { id, geometry, properties } = result.data;
  const [longitude, latitude, depthKm] = geometry.coordinates;
  return {
    id,
    source: 'usgs',
    magnitude: properties.mag,
    magnitudeType: properties.magType ?? null,
    place: properties.place ?? null,
    time: properties.time,
    depthKm,
    longitude,
    latitude,
    url: properties.url,
  };
}

export const usgsAdapter: SourceAdapter = { label: 'USGS', getQueryUrl, getEarthquake };
