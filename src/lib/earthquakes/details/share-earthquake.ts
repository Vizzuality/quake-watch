import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouteMatch, RegisteredRouter, RouteById } from '@tanstack/react-router';

import { isServer } from '@/paraglide/runtime';

import type { Earthquake } from '../types';
import { PAGE_FETCH_TIMEOUT_MS } from './detail-fetch-policy';
import { getServerDetail } from './detail-server-cache';
import { getEmscEarthquakeDetail } from './emsc';
import { earthquakeDetailQueryOptions, getDetailEarthquake, getQuakeRef } from './query-options';
import type { EarthquakeDetail } from './query-options';
import { getUsgsEarthquakeDetail } from './usgs';

type QuakeRef = NonNullable<ReturnType<typeof getQuakeRef>>;

type HomeLoaderData = RouteById<RegisteredRouter['routeTree'], '/'>['types']['loaderData'];

async function getServerEarthquakeDetail({
  source,
  id,
}: QuakeRef): Promise<EarthquakeDetail | null> {
  const signal = AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS);
  if (source === 'usgs') {
    const detail = await getServerDetail(source, id, getUsgsEarthquakeDetail, signal);
    return detail && { source, detail };
  }
  const detail = await getServerDetail(source, id, getEmscEarthquakeDetail, signal);
  return detail && { source, detail };
}

export async function getShareEarthquake(
  queryClient: QueryClient,
  quake: string | undefined,
): Promise<Earthquake | undefined> {
  if (!quake) return undefined;
  const ref = getQuakeRef(quake);
  if (!ref) return undefined;
  const { queryKey } = earthquakeDetailQueryOptions(quake);
  if (!isServer)
    return getDetailEarthquake(queryClient.getQueryData(queryKey) ?? null) ?? undefined;
  try {
    const detail = await queryClient.fetchQuery({
      queryKey,
      queryFn: () => getServerEarthquakeDetail(ref),
    });
    return getDetailEarthquake(detail) ?? undefined;
  } catch {
    queryClient.removeQueries({ queryKey, exact: true });
    return undefined;
  }
}

export function getShareQuake(
  earthquake: Pick<Earthquake, 'source' | 'id'> | undefined,
): string | undefined {
  return earthquake && `${earthquake.source}:${earthquake.id}`;
}

export function getShareQuakeFromMatches(
  matches: Pick<AnyRouteMatch, 'routeId' | 'loaderData'>[],
): string | undefined {
  const loaderData: HomeLoaderData | undefined = matches.find(
    ({ routeId }) => routeId === '/',
  )?.loaderData;
  return getShareQuake(loaderData?.earthquake);
}
