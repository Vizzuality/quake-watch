import { z } from 'zod';

import type { Earthquake } from '../types';
import { coordinatesSchema } from './feature-collection';
import type { SourceAdapter } from './feature-collection';

export const EMSC_QUERY_URL = 'https://www.seismicportal.eu/fdsnws/event/1/query';
const EMSC_EVENT_URL = 'https://www.seismicportal.eu/eventdetails.html';

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

export const emscAdapter: SourceAdapter = { label: 'EMSC', getEarthquake };
