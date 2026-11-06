import { z } from 'zod';

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
  getEarthquake(feature: unknown): Earthquake | null;
};

export function getFeatures(json: unknown): unknown[] {
  return featureCollectionSchema.parse(json).features;
}
