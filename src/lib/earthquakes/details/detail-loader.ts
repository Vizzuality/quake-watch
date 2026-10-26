import type { EnsureQueryDataOptions, QueryClient, QueryKey } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';

import { isServer } from '@/paraglide/runtime';

import type { Earthquake } from '../types';

type DetailLoaderData = { earthquake: Earthquake | undefined };

export async function getDetailLoaderData<
  TDetail extends { earthquake: Earthquake },
  TQueryKey extends QueryKey,
>(
  queryClient: QueryClient,
  options: EnsureQueryDataOptions<TDetail | null, Error, TDetail | null, TQueryKey>,
): Promise<DetailLoaderData> {
  if (!isServer) {
    void queryClient.prefetchQuery(options);
    const cached = queryClient.getQueryData<TDetail | null>(options.queryKey);
    return { earthquake: cached?.earthquake };
  }
  const detail = await queryClient.ensureQueryData(options);
  if (detail === null) throw notFound();
  return { earthquake: detail.earthquake };
}
