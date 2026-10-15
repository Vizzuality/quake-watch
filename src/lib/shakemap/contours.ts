import { z } from 'zod';

import { getDistanceKm } from '@/lib/earthquakes/distance';
import { EarthquakeSourceError } from '@/lib/earthquakes/query-options';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';

import { S_WAVE_KM_S, getArrivalSeconds } from './wave';

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

export type ContourSegment = {
  mmi: number;
  color: string;
  coordinates: Array<readonly [number, number]>;
  arrival: number;
};

const SEGMENT_VERTICES = 6;

function getLineChunks<T>(line: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < line.length - 1; start += SEGMENT_VERTICES - 1) {
    chunks.push(line.slice(start, start + SEGMENT_VERTICES));
  }
  return chunks;
}

export function getContourSegments(
  contours: readonly ShakemapContour[],
  epicenter: SearchCenter,
  depthKm: number,
): ContourSegment[] {
  const segments = contours.flatMap(({ mmi, color, lines }) =>
    lines.flatMap(getLineChunks).map((coordinates) => ({
      mmi,
      color,
      coordinates,
      arrival: Math.max(
        ...coordinates.map(([longitude, latitude]) =>
          getArrivalSeconds(
            getDistanceKm(epicenter, { latitude, longitude }),
            depthKm,
            S_WAVE_KM_S,
          ),
        ),
      ),
    })),
  );
  return segments.toSorted((first, second) => first.arrival - second.arrival);
}

export function getContoursReachKm(
  contours: readonly ShakemapContour[],
  epicenter: SearchCenter,
): number {
  let reachKm = 0;
  for (const { lines } of contours) {
    for (const line of lines) {
      for (const [longitude, latitude] of line) {
        reachKm = Math.max(reachKm, getDistanceKm(epicenter, { latitude, longitude }));
      }
    }
  }
  return reachKm;
}
