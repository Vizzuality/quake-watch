import { getDistanceKm } from '@/lib/earthquakes/distance';
import { FELT_INTENSITY } from '@/lib/earthquakes/intensity';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';

import type { ShakemapContour } from './contours';
import { getContoursReachKm } from './contours';
import { getGridLatitude, getGridLongitude } from './coverage';
import type { ShakemapGrid } from './coverage';

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

export function getDrawnReachKm(
  grid: ShakemapGrid,
  contours: readonly ShakemapContour[],
  epicenter: SearchCenter,
): number {
  return Math.max(getMaxReachKm(grid, epicenter), getContoursReachKm(contours, epicenter));
}
