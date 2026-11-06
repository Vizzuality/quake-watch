import { queryOptions } from '@tanstack/react-query';

import { getEarthquakeFilters } from './search-schema';
import type { EarthquakeFilters, EarthquakeSource } from './search-schema';
import { emscAdapter } from './sources/emsc';
import { getFeatures } from './sources/feature-collection';
import type { SourceAdapter } from './sources/feature-collection';
import { EarthquakeSourceError } from './sources/source-error';
import { usgsAdapter } from './sources/usgs';
import type { Earthquake } from './types';

export const EARTHQUAKE_LIMIT = 20_000;
export const LIVE_REFETCH_MS = 60_000;
export const LIVE_STALE_MS = 30_000;
export const ARCHIVE_STALE_MS = 5 * 60_000;

export const SOURCE_ADAPTERS: Record<EarthquakeSource, SourceAdapter> = {
  emsc: emscAdapter,
  usgs: usgsAdapter,
};

export type EarthquakesResult = {
  earthquakes: Earthquake[];
  isTruncated: boolean;
  fetchedAt: number;
};

export function getEarthquakesQueryKey(filters: EarthquakeFilters) {
  return ['earthquakes', getEarthquakeFilters(filters)] as const;
}

export async function getEarthquakes(
  filters: EarthquakeFilters,
  signal: AbortSignal,
): Promise<EarthquakesResult> {
  const adapter = SOURCE_ADAPTERS[filters.source];
  const now = new Date();
  const fetchedAt = now.getTime();
  const response = await fetch(adapter.getQueryUrl(filters, now, EARTHQUAKE_LIMIT), { signal });
  if (!response.ok) throw new EarthquakeSourceError(filters.source, response.status);
  if (response.status === 204) return { earthquakes: [], isTruncated: false, fetchedAt };
  const features = getFeatures(await response.json());
  const earthquakes = features.flatMap((feature) => adapter.getEarthquake(feature) ?? []);
  return { earthquakes, isTruncated: features.length >= EARTHQUAKE_LIMIT, fetchedAt };
}

export function earthquakesQueryOptions(search: EarthquakeFilters) {
  const filters = getEarthquakeFilters(search);
  const isLive = filters.interval === '24h';
  return queryOptions({
    queryKey: getEarthquakesQueryKey(filters),
    queryFn: ({ signal }) => getEarthquakes(filters, signal),
    refetchInterval: isLive ? LIVE_REFETCH_MS : false,
    staleTime: isLive ? LIVE_STALE_MS : ARCHIVE_STALE_MS,
  });
}
