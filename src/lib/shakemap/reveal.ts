import { getDistanceKm } from '@/lib/earthquakes/distance';
import { FELT_INTENSITY } from '@/lib/earthquakes/intensity';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';

import { getGridLatitude, getGridLongitude } from './coverage';
import type { ShakemapGrid } from './coverage';

export const SHAKEMAP_PLAY_DURATION_MS = 4_000;

export function getMaxReachKm(grid: ShakemapGrid, epicenter: SearchCenter): number {
  let feltReachKm = 0;
  let hasFeltCell = false;
  for (let row = 0; row < grid.rows; row++) {
    const latitude = getGridLatitude(grid, row);
    for (let column = 0; column < grid.columns; column++) {
      if (!(grid.values[row * grid.columns + column] >= FELT_INTENSITY)) continue;
      const longitude = getGridLongitude(grid, column);
      feltReachKm = Math.max(feltReachKm, getDistanceKm(epicenter, { latitude, longitude }));
      hasFeltCell = true;
    }
  }
  if (hasFeltCell) return feltReachKm;
  return Math.max(
    ...[grid.south, grid.north].flatMap((latitude) =>
      [grid.west, grid.east].map((longitude) => getDistanceKm(epicenter, { latitude, longitude })),
    ),
  );
}

export function getRevealRadiusKm(progress: number, maxReachKm: number): number {
  if (Number.isNaN(progress)) return 0;
  return Math.min(1, Math.max(0, progress)) * maxReachKm;
}

export function getIsInsideReveal(
  epicenter: SearchCenter,
  point: SearchCenter,
  radiusKm: number,
): boolean {
  return getDistanceKm(epicenter, point) <= radiusKm;
}
