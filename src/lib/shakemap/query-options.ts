import { queryOptions } from '@tanstack/react-query';

import { EarthquakeSourceError } from '@/lib/earthquakes/query-options';

import { getShakemapContours } from './contours';
import { getShakemapGrid } from './coverage';

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new EarthquakeSourceError('usgs', response.status);
  return response.json();
}

export function shakemapCoverageQueryOptions(url: string) {
  return queryOptions({
    queryKey: ['shakemap', 'coverage', url] as const,
    queryFn: async ({ signal }) => getShakemapGrid(await getJson(url, signal)),
    staleTime: Infinity,
    retry: 1,
  });
}

export function shakemapContoursQueryOptions(url: string) {
  return queryOptions({
    queryKey: ['shakemap', 'contours', url] as const,
    queryFn: async ({ signal }) => getShakemapContours(await getJson(url, signal)),
    staleTime: Infinity,
    retry: 1,
  });
}
