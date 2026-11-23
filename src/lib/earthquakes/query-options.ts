import { queryOptions } from '@tanstack/react-query';

import { getEarthquakeFilters } from './search-schema';
import type { EarthquakeFilters, EarthquakeSource, Interval, SourceFilter } from './search-schema';
import { emscAdapter } from './sources/emsc';
import { LIVE_LIMIT, getFdsnQuery, getFeatures } from './sources/feature-collection';
import type { FdsnQuery, SourceAdapter } from './sources/feature-collection';
import { getMergedEarthquakes } from './sources/merge';
import { EarthquakeSourceError } from './sources/source-error';
import { usgsAdapter } from './sources/usgs';
import type { Earthquake } from './types';

export const EARTHQUAKE_LIMIT = LIVE_LIMIT;
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

export const ALL_SOURCES_LABEL = `${emscAdapter.label} + ${usgsAdapter.label}`;

export function getSourceLabel(source: SourceFilter): string {
  if (source === 'all') return ALL_SOURCES_LABEL;
  return SOURCE_ADAPTERS[source].label;
}

type CatalogueResult = { earthquakes: Earthquake[]; isTruncated: boolean };

export function getEarthquakesQueryKey(filters: EarthquakeFilters) {
  return ['earthquakes', getEarthquakeFilters(filters)] as const;
}

async function getCatalogueEarthquakes(
  source: EarthquakeSource,
  filters: EarthquakeFilters,
  query: FdsnQuery,
  signal: AbortSignal,
): Promise<CatalogueResult> {
  const adapter = SOURCE_ADAPTERS[source];
  const response = await fetch(adapter.getQueryUrl(filters, query), { signal });
  if (!response.ok) throw new EarthquakeSourceError(source, response.status);
  if (response.status === 204) return { earthquakes: [], isTruncated: false };
  const features = getFeatures(await response.json());
  const earthquakes = features.flatMap((feature) => adapter.getEarthquake(feature) ?? []);
  return { earthquakes, isTruncated: features.length >= query.limit };
}

export async function getEarthquakes(
  filters: EarthquakeFilters,
  signal: AbortSignal,
): Promise<EarthquakesResult> {
  const fetchedAt = Date.now();
  const query = getFdsnQuery(filters, fetchedAt);
  if (filters.source !== 'all') {
    const result = await getCatalogueEarthquakes(filters.source, filters, query, signal);
    return { ...result, fetchedAt };
  }
  const [emsc, usgs] = await Promise.all([
    getCatalogueEarthquakes('emsc', filters, query, signal),
    getCatalogueEarthquakes('usgs', filters, query, signal),
  ]);
  return {
    earthquakes: getMergedEarthquakes(emsc.earthquakes, usgs.earthquakes),
    isTruncated: emsc.isTruncated || usgs.isTruncated,
    fetchedAt,
  };
}

export function getEarthquakesStaleMs(interval: Interval): number {
  return interval === '24h' ? LIVE_STALE_MS : ARCHIVE_STALE_MS;
}

export function earthquakesQueryOptions(search: EarthquakeFilters) {
  const filters = getEarthquakeFilters(search);
  const isLive = filters.interval === '24h';
  return queryOptions({
    queryKey: getEarthquakesQueryKey(filters),
    queryFn: ({ signal }) => getEarthquakes(filters, signal),
    refetchInterval: isLive ? LIVE_REFETCH_MS : false,
    staleTime: getEarthquakesStaleMs(filters.interval),
  });
}
