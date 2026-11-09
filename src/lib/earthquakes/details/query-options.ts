import { queryOptions } from '@tanstack/react-query';

import { QUAKE_PATTERN, type EarthquakeSource } from '../search-schema';
import type { Earthquake } from '../types';
import { getEmscEarthquakeDetail, type EmscEarthquakeDetail } from './emsc';
import { getUsgsEarthquakeDetail, type UsgsEarthquakeDetail } from './usgs';

export type EarthquakeDetail =
  | { source: 'emsc'; detail: EmscEarthquakeDetail }
  | { source: 'usgs'; detail: UsgsEarthquakeDetail };

type QuakeRef = { source: EarthquakeSource; id: string };

type DetailFetcher = (id: string, signal: AbortSignal) => Promise<EarthquakeDetail | null>;

const DETAIL_STALE_TIME_MS = 5 * 60_000;

const DETAIL_FETCHERS: Record<EarthquakeSource, DetailFetcher> = {
  emsc: async (id, signal) => {
    const detail = await getEmscEarthquakeDetail(id, signal);
    return detail && { source: 'emsc', detail };
  },
  usgs: async (id, signal) => {
    const detail = await getUsgsEarthquakeDetail(id, signal);
    return detail && { source: 'usgs', detail };
  },
};

function isEarthquakeSource(value: string): value is EarthquakeSource {
  return Object.hasOwn(DETAIL_FETCHERS, value);
}

export function getQuakeRef(quake: string): QuakeRef | null {
  if (!QUAKE_PATTERN.test(quake)) return null;
  const separator = quake.indexOf(':');
  const source = quake.slice(0, separator);
  if (!isEarthquakeSource(source)) return null;
  return { source, id: quake.slice(separator + 1) };
}

export function earthquakeDetailQueryOptions(quake: string) {
  return queryOptions({
    queryKey: ['earthquake', quake] as const,
    queryFn: ({ signal }) => {
      const ref = getQuakeRef(quake);
      if (!ref) return null;
      return DETAIL_FETCHERS[ref.source](ref.id, signal);
    },
    staleTime: DETAIL_STALE_TIME_MS,
  });
}

export function getDetailEarthquake(detail: EarthquakeDetail | null): Earthquake | null {
  return detail?.detail.earthquake ?? null;
}
