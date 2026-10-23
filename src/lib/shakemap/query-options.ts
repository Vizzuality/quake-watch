import { queryOptions, skipToken } from '@tanstack/react-query';

import { EarthquakeSourceError } from '@/lib/earthquakes/query-options';

import { getShakemapContours } from './contours';

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new EarthquakeSourceError('usgs', response.status);
  return response.json();
}

export function shakemapContoursQueryOptions(url: string | undefined) {
  return queryOptions({
    queryKey: ['shakemap', 'contours', url] as const,
    queryFn:
      url === undefined
        ? skipToken
        : async ({ signal }) => getShakemapContours(await getJson(url, signal)),
    staleTime: Infinity,
    retry: 1,
  });
}
