import type { QueryClient } from '@tanstack/react-query';

import { isServer } from '@/paraglide/runtime';

import { PAGE_FETCH_TIMEOUT_MS } from './details/detail-fetch-policy';
import { getCallerBound } from './details/detail-server-cache';
import {
  type EarthquakesResult,
  earthquakesQueryOptions,
  getEarthquakes,
  getEarthquakesQueryKey,
  getEarthquakesStaleMs,
} from './query-options';
import { getTimeWindow } from './search-schema';
import type { EarthquakeFilters } from './search-schema';
import { isLongWindow } from './sources/feature-collection';

export const LIST_SERVER_FETCH_TIMEOUT_MS = 15_000;

type CacheEntry = { result?: EarthquakesResult; refresh?: Promise<EarthquakesResult> };

const cache = new Map<string, CacheEntry>();

function getCacheEntry(filters: EarthquakeFilters): CacheEntry {
  const key = JSON.stringify(getEarthquakesQueryKey(filters));
  const entry = cache.get(key) ?? {};
  cache.set(key, entry);
  return entry;
}

function getRefresh(entry: CacheEntry, filters: EarthquakeFilters): Promise<EarthquakesResult> {
  if (entry.refresh) return entry.refresh;
  const refresh = getEarthquakes(filters, AbortSignal.timeout(LIST_SERVER_FETCH_TIMEOUT_MS)).then(
    (result) => {
      entry.result = result;
      return result;
    },
  );
  entry.refresh = refresh;
  void refresh
    .catch(() => undefined)
    .finally(() => {
      entry.refresh = undefined;
    });
  return refresh;
}

function getResultYoungerThan(
  result: EarthquakesResult | undefined,
  maxAgeMs: number,
): EarthquakesResult | undefined {
  if (result && Date.now() - result.fetchedAt < maxAgeMs) return result;
  return undefined;
}

export async function getServerEarthquakes(
  filters: EarthquakeFilters,
  signal: AbortSignal,
): Promise<EarthquakesResult> {
  const entry = getCacheEntry(filters);
  const staleMs = getEarthquakesStaleMs(filters.interval);
  const fresh = getResultYoungerThan(entry.result, staleMs / 2);
  if (fresh) return fresh;
  const refresh = getRefresh(entry, filters);
  return getResultYoungerThan(entry.result, staleMs) ?? getCallerBound(refresh, signal);
}

export async function prefetchServerEarthquakes(
  queryClient: QueryClient,
  filters: EarthquakeFilters,
): Promise<void> {
  if (!isServer || isLongWindow(getTimeWindow(filters, Date.now()))) return;
  try {
    const result = await getServerEarthquakes(filters, AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS));
    queryClient.setQueryData(earthquakesQueryOptions(filters).queryKey, result, {
      updatedAt: result.fetchedAt,
    });
  } catch {
    return;
  }
}
