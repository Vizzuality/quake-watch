import { LIVE_REFETCH_MS, getEarthquakesQueryKey } from './query-options';
import type { EarthquakesResult } from './query-options';
import type { EarthquakeSearch } from './search-schema';

type CacheEntry = { promise: Promise<EarthquakesResult>; expiresAt: number };

const cache = new Map<string, CacheEntry>();

export function getCachedEarthquakes(
  search: EarthquakeSearch,
  load: (search: EarthquakeSearch) => Promise<EarthquakesResult>,
): Promise<EarthquakesResult> {
  const key = JSON.stringify(getEarthquakesQueryKey(search));
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = load(search);
  cache.set(key, { promise, expiresAt: now + LIVE_REFETCH_MS });
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  return promise;
}
