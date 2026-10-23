import { z } from 'zod';

import { EarthquakeSourceError } from '@/lib/earthquakes/query-options';

export type ShakemapContour = {
  mmi: number;
  color: string;
  lines: Array<Array<readonly [number, number]>>;
};

const positionSchema = z.array(z.number()).min(2);
const lineSchema = z.array(positionSchema).min(2);

const contoursSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({ value: z.number(), color: z.string() }),
      geometry: z.discriminatedUnion('type', [
        z.object({ type: z.literal('LineString'), coordinates: lineSchema }),
        z.object({ type: z.literal('MultiLineString'), coordinates: z.array(lineSchema) }),
      ]),
    }),
  ),
});

export function getShakemapContours(json: unknown): ShakemapContour[] {
  const parsed = contoursSchema.safeParse(json);
  if (!parsed.success) throw new EarthquakeSourceError('usgs', 200);
  return parsed.data.features.map(({ properties, geometry }) => {
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
    return {
      mmi: properties.value,
      color: properties.color,
      lines: lines.map((line) =>
        line.map(([longitude, latitude]) => [longitude, latitude] as const),
      ),
    };
  });
}
