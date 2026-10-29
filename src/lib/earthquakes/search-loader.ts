import type { QueryClient } from '@tanstack/react-query';

import { isServer } from '@/paraglide/runtime';

import { SERVER_FETCH_TIMEOUT_MS } from './details/detail-fetch-policy';
import { getEarthquakes, getEarthquakesQueryKey } from './query-options';
import type { EarthquakeSearch } from './search-schema';
import { getCachedEarthquakes } from './server-cache';

export async function seedSearchQuery(
  queryClient: QueryClient,
  search: EarthquakeSearch,
): Promise<void> {
  if (!isServer) return;
  const data = await getCachedEarthquakes(search, (cacheSearch) =>
    getEarthquakes(cacheSearch, AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS)),
  ).catch(() => null);
  if (data) {
    queryClient.setQueryData(getEarthquakesQueryKey(search), data, { updatedAt: data.fetchedAt });
  }
}
