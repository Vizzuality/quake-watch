import { queryOptions } from '@tanstack/react-query';

import { getUsgsEarthquakeDetail } from './usgs';

const DETAIL_STALE_MS = 5 * 60_000;

export function usgsEarthquakeDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['earthquake-detail', 'usgs', id] as const,
    queryFn: ({ signal }) => getUsgsEarthquakeDetail(id, signal),
    staleTime: DETAIL_STALE_MS,
    retry: 1,
  });
}
