import { useQuery } from '@tanstack/react-query';
import type { QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

import type { Earthquake } from '@/lib/earthquakes/types';

export function useDetailHeadRefresh<
  TDetail extends { earthquake: Earthquake },
  TQueryKey extends QueryKey,
>({
  routeId,
  loaderEarthquake,
  options,
}: {
  routeId: string;
  loaderEarthquake: Earthquake | undefined;
  options: UseQueryOptions<TDetail | null, Error, TDetail | null, TQueryKey>;
}) {
  const router = useRouter();
  const { data } = useQuery(options);
  const isHeadMissingData = !loaderEarthquake && Boolean(data?.earthquake);

  useEffect(() => {
    if (!isHeadMissingData) return;
    // The client loader doesn't wait for the fetch, so head() ran without the earthquake.
    void router.invalidate({ filter: (match) => match.routeId === routeId });
  }, [isHeadMissingData, router, routeId]);
}
