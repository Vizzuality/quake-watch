import { queryOptions } from '@tanstack/react-query';

import { getEmscEarthquakeDetail } from './emsc';

const DETAIL_STALE_MS = 5 * 60_000;

export function emscEarthquakeDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['earthquake-detail', 'emsc', id] as const,
    queryFn: ({ signal }) => getEmscEarthquakeDetail(id, signal),
    staleTime: DETAIL_STALE_MS,
    retry: 1,
  });
}
