import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { DepthLegend } from '@/containers/depth-legend/depth-legend';
import { GlobeSlot } from '@/containers/globe/globe-slot';
import { getShareEarthquake } from '@/lib/earthquakes/details/share-earthquake';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { EARTHQUAKE_SEARCH_ROUTE, getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import { getDetailMeta } from '@/lib/seo/detail-meta';
import { m } from '@/paraglide/messages';
import { getLocale, isServer } from '@/paraglide/runtime';

const Globe = lazy(() => import('@/containers/globe/globe'));

export const Route = createFileRoute('/')({
  ...EARTHQUAKE_SEARCH_ROUTE,
  loaderDeps: ({ search }) => ({ filters: getEarthquakeFilters(search), quake: search.quake }),
  loader: async ({ context, deps, preload }) => {
    if (!preload && !isServer) {
      void context.queryClient.prefetchQuery(earthquakesQueryOptions(deps.filters));
    }
    return { earthquake: await getShareEarthquake(context.queryClient, deps.quake) };
  },
  head: ({ match, loaderData }) => ({
    meta: getDetailMeta({
      status: match.status,
      earthquake: loaderData?.earthquake,
      locale: getLocale(),
    }),
  }),
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const { source, interval, minmag, depth } = search;

  return (
    <main
      className="relative min-h-dvh overflow-hidden text-foreground"
      data-source={source}
      data-interval={interval}
      data-minmag={minmag}
      data-depth={depth}
    >
      <div className="absolute inset-0">
        <GlobeSlot>
          <Globe />
        </GlobeSlot>
      </div>
      <h1 className="sr-only">{m.app_title()}</h1>
      <header className="pointer-events-none relative z-10 px-10 py-4">
        <div className="flex h-10 items-center">
          <Wordmark />
        </div>
      </header>
      <DepthLegend />
    </main>
  );
}
