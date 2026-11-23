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
export const LIST_SERVER_CACHE_MAX_ENTRIES = 64;

type CacheEntry = { result?: EarthquakesResult; refresh?: Promise<EarthquakesResult> };

const cache = new Map<string, CacheEntry>();

function getCacheEntry(filters: EarthquakeFilters): CacheEntry {
  const key = JSON.stringify(getEarthquakesQueryKey(filters));
  const entry = cache.get(key) ?? {};
  cache.delete(key);
  cache.set(key, entry);
  for (const oldest of cache.keys()) {
    if (cache.size <= LIST_SERVER_CACHE_MAX_ENTRIES) break;
    cache.delete(oldest);
  }
  return entry;
}

function isServerPrefetched(filters: EarthquakeFilters): boolean {
  if (filters.interval === 'custom') return false;
  return !isLongWindow(getTimeWindow(filters, Date.now()));
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
  if (filters.interval === 'custom') return getEarthquakes(filters, signal);
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
  if (!isServer || !isServerPrefetched(filters)) return;
  try {
    const result = await getServerEarthquakes(filters, AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS));
    queryClient.setQueryData(earthquakesQueryOptions(filters).queryKey, result, {
      updatedAt: result.fetchedAt,
    });
  } catch {
    return;
  }
}
