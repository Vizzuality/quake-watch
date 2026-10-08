import { z } from 'zod';

import { getSearchCenter, getTimeRange } from '../search-schema';
import type { EarthquakeSearch } from '../search-schema';
import type { Earthquake } from '../types';
import { coordinatesSchema } from './feature-collection';
import type { SourceAdapter } from './feature-collection';

const USGS_QUERY_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

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

function getQueryUrl(search: EarthquakeSearch, now: Date, limit: number): string {
  const { start, end } = getTimeRange(search, now);
  const params = new URLSearchParams({
    format: 'geojson',
    orderby: 'time',
    limit: String(limit),
    minmagnitude: String(search.minmag),
    starttime: start.toISOString(),
  });
  if (end) params.set('endtime', end.toISOString());
  const center = getSearchCenter(search);
  if (center) {
    params.set('latitude', String(center.latitude));
    params.set('longitude', String(center.longitude));
    params.set('maxradiuskm', String(search.radius));
  }
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
