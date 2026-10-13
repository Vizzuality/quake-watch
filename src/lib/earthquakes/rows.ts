import { getDistanceKm } from './distance';
import { DEFAULT_SORT, getSortingState } from './search-schema';
import type { SearchCenter } from './search-schema';
import type { Earthquake } from './types';

export const EARTHQUAKE_PAGE_SIZE = 50;

export type EarthquakeRow = Earthquake & { distanceKm: number | null };

export function getEarthquakeRows(
  earthquakes: Earthquake[],
  center: SearchCenter | null,
): EarthquakeRow[] {
  return earthquakes.map((earthquake) => ({
    ...earthquake,
    distanceKm: center ? getDistanceKm(center, earthquake) : null,
  }));
}

export function getPageIndex(page: number, rowCount: number): number {
  const lastIndex = Math.max(0, Math.ceil(rowCount / EARTHQUAKE_PAGE_SIZE) - 1);
  return Math.min(page - 1, lastIndex);
}

export function getTableSorting(sort: string, hasDistance: boolean) {
  const sorting = getSortingState(sort);
  if (!hasDistance && sorting[0]?.id === 'distance') return getSortingState(DEFAULT_SORT);
  return sorting;
}
