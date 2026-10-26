import { queryOptions } from '@tanstack/react-query';

import { isServer } from '@/paraglide/runtime';

import { getDetailRetry, getDetailSignal } from './detail-fetch-policy';
import { getUsgsEarthquakeDetail } from './usgs';

const DETAIL_STALE_MS = 5 * 60_000;

export function usgsEarthquakeDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['earthquake-detail', 'usgs', id] as const,
    queryFn: ({ signal }) => getUsgsEarthquakeDetail(id, getDetailSignal(signal, isServer)),
    staleTime: DETAIL_STALE_MS,
    retry: getDetailRetry(isServer),
  });
}
