import { queryOptions } from '@tanstack/react-query';

import { isServer } from '@/paraglide/runtime';

import { getDetailRetry } from './detail-fetch-policy';
import { getServerDetail } from './detail-server-cache';
import { getUsgsEarthquakeDetail } from './usgs';

const DETAIL_STALE_MS = 5 * 60_000;

export function usgsEarthquakeDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['earthquake-detail', 'usgs', id] as const,
    queryFn: ({ signal }) =>
      isServer
        ? getServerDetail('usgs', id, getUsgsEarthquakeDetail, signal)
        : getUsgsEarthquakeDetail(id, signal),
    staleTime: DETAIL_STALE_MS,
    retry: getDetailRetry(isServer),
  });
}
