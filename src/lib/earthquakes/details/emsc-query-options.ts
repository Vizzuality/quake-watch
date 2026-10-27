import { queryOptions } from '@tanstack/react-query';

import { isServer } from '@/paraglide/runtime';

import { getDetailRetry, getDetailSignal } from './detail-fetch-policy';
import { getEmscEarthquakeDetail } from './emsc';

const DETAIL_STALE_MS = 5 * 60_000;

export function emscEarthquakeDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['earthquake-detail', 'emsc', id] as const,
    queryFn: ({ signal }) => getEmscEarthquakeDetail(id, getDetailSignal(signal, isServer)),
    staleTime: DETAIL_STALE_MS,
    retry: getDetailRetry(isServer),
  });
}
