import { queryOptions } from '@tanstack/react-query';

import type { EarthquakeSearch, EarthquakeSource } from './search-schema';
import { emscAdapter } from './sources/emsc';
import { getFeatures } from './sources/feature-collection';
import type { SourceAdapter } from './sources/feature-collection';
import { usgsAdapter } from './sources/usgs';
import type { Earthquake } from './types';

export const EARTHQUAKE_LIMIT = 1000;
const LIVE_REFETCH_MS = 60_000;
const ARCHIVE_STALE_MS = 5 * 60_000;

export const SOURCE_ADAPTERS: Record<EarthquakeSource, SourceAdapter> = {
  emsc: emscAdapter,
  usgs: usgsAdapter,
};

type EarthquakesResult = { earthquakes: Earthquake[]; isTruncated: boolean; fetchedAt: number };

export class EarthquakeSourceError extends Error {
  constructor(
    readonly source: EarthquakeSource,
    readonly status: number,
  ) {
    super(`${SOURCE_ADAPTERS[source].label} request failed with status ${status}`);
    this.name = 'EarthquakeSourceError';
  }
}

export function getEarthquakesQueryKey({
  source,
  lat,
  lon,
  radius,
  period,
  from,
  to,
  minmag,
}: EarthquakeSearch) {
  return ['earthquakes', source, { lat, lon, radius, period, from, to, minmag }] as const;
}

async function getEarthquakes(
  search: EarthquakeSearch,
  signal: AbortSignal,
): Promise<EarthquakesResult> {
  const adapter = SOURCE_ADAPTERS[search.source];
  const now = new Date();
  const fetchedAt = now.getTime();
  const response = await fetch(adapter.getQueryUrl(search, now, EARTHQUAKE_LIMIT), {
    signal,
  });
  if (!response.ok) throw new EarthquakeSourceError(search.source, response.status);
  if (response.status === 204) return { earthquakes: [], isTruncated: false, fetchedAt };
  const features = getFeatures(await response.json());
  const earthquakes = features.flatMap((feature) => adapter.getEarthquake(feature) ?? []);
  return { earthquakes, isTruncated: features.length >= EARTHQUAKE_LIMIT, fetchedAt };
}

export function earthquakesQueryOptions(search: EarthquakeSearch) {
  const isLive = search.period === '24h';
  return queryOptions({
    queryKey: getEarthquakesQueryKey(search),
    queryFn: ({ signal }) => getEarthquakes(search, signal),
    refetchInterval: isLive ? LIVE_REFETCH_MS : false,
    staleTime: isLive ? 0 : ARCHIVE_STALE_MS,
  });
}
