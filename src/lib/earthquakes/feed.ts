import { z } from 'zod';

import type { Earthquake } from './types';

export const USGS_FEED_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

const featureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(z.unknown()),
});

const featureSchema = z.object({
  id: z.string(),
  geometry: z.object({
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number()]),
  }),
  properties: z.object({
    mag: z.number(),
    place: z.string().nullable(),
    time: z.number(),
    url: z.string(),
  }),
});

export function getEarthquakesFromFeed(json: unknown): Earthquake[] {
  const { features } = featureCollectionSchema.parse(json);

  return features.flatMap((raw) => {
    const result = featureSchema.safeParse(raw);
    if (!result.success) return [];

    const { id, geometry, properties } = result.data;
    const [longitude, latitude, depthKm] = geometry.coordinates;

    return [
      {
        id,
        magnitude: properties.mag,
        place: properties.place ?? 'Unknown location',
        time: properties.time,
        depthKm,
        longitude,
        latitude,
        url: properties.url,
      },
    ];
  });
}

export async function getLatestEarthquakes(): Promise<Earthquake[]> {
  const response = await fetch(USGS_FEED_URL);
  if (!response.ok) {
    throw new Error(`USGS feed request failed with status ${response.status}`);
  }
  return getEarthquakesFromFeed(await response.json());
}
