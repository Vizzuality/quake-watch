import { z } from 'zod';

import type { Earthquake } from '../types';
import { coordinatesSchema } from './feature-collection';
import type { SourceAdapter } from './feature-collection';

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

export const usgsAdapter: SourceAdapter = { label: 'USGS', getEarthquake };
