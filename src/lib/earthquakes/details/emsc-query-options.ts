import { queryOptions } from '@tanstack/react-query';

import { isServer } from '@/paraglide/runtime';

import { getDetailRetry } from './detail-fetch-policy';
import { getServerDetail } from './detail-server-cache';
import { getEmscEarthquakeDetail } from './emsc';

const DETAIL_STALE_MS = 5 * 60_000;

export function emscEarthquakeDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['earthquake-detail', 'emsc', id] as const,
    queryFn: ({ signal }) =>
      isServer
        ? getServerDetail('emsc', id, getEmscEarthquakeDetail, signal)
        : getEmscEarthquakeDetail(id, signal),
    staleTime: DETAIL_STALE_MS,
    retry: getDetailRetry(isServer),
  });
}
