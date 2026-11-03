import type { QueryClient } from '@tanstack/react-query';

import { isServer } from '@/paraglide/runtime';

import { SERVER_FETCH_TIMEOUT_MS } from './details/detail-fetch-policy';
import { earthquakesQueryOptions, getEarthquakes, getEarthquakesQueryKey } from './query-options';
import type { EarthquakeSearch } from './search-schema';
import { getCachedEarthquakes } from './server-cache';

type SearchLoadOptions = { preload: boolean };

export function prefetchSearchQuery(
  queryClient: QueryClient,
  search: EarthquakeSearch,
  { preload }: SearchLoadOptions,
): void {
  if (isServer || preload) return;
  void queryClient.prefetchQuery(earthquakesQueryOptions(search));
}

export async function seedSearchQuery(
  queryClient: QueryClient,
  search: EarthquakeSearch,
  options: SearchLoadOptions = { preload: false },
): Promise<void> {
  if (!isServer) {
    prefetchSearchQuery(queryClient, search, options);
    return;
  }
  const data = await getCachedEarthquakes(search, (cacheSearch) =>
    getEarthquakes(cacheSearch, AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS)),
  ).catch(() => null);
  if (data) {
    queryClient.setQueryData(getEarthquakesQueryKey(search), data, { updatedAt: data.fetchedAt });
  }
}
