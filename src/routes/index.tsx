import { useQuery } from '@tanstack/react-query';
import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';

import { GlobeSlot } from '@/containers/globe/globe-slot';
import { Header } from '@/containers/header/header';
import { HomeSheet } from '@/containers/home-sheet/home-sheet';
import { LiveBanner } from '@/containers/live-banner/live-banner';
import { Timeline } from '@/containers/timeline/timeline';
import { getShareEarthquake } from '@/lib/earthquakes/details/share-earthquake';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { EARTHQUAKE_SEARCH_ROUTE, getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import { prefetchServerEarthquakes } from '@/lib/earthquakes/server-earthquakes';
import { getDetailMeta } from '@/lib/seo/detail-meta';
import { m } from '@/paraglide/messages';
import { getLocale, isServer } from '@/paraglide/runtime';

const Globe = lazy(() => import('@/containers/globe/globe'));
const EarthquakePanel = lazy(() => import('@/containers/earthquake-panel/earthquake-panel'));

export const Route = createFileRoute('/')({
  ...EARTHQUAKE_SEARCH_ROUTE,
  loaderDeps: ({ search }) => ({ filters: getEarthquakeFilters(search), quake: search.quake }),
  loader: async ({ context, deps, preload }) => {
    if (!preload && !isServer) {
      void context.queryClient.prefetchQuery(earthquakesQueryOptions(deps.filters));
    }
    const [earthquake] = await Promise.all([
      getShareEarthquake(context.queryClient, deps.quake),
      prefetchServerEarthquakes(context.queryClient, deps.filters),
    ]);
    return { earthquake };
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
  const { source, interval, minmag, depth, quake } = search;

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
      <Timeline />
      <h1 className="sr-only">{m.app_title()}</h1>
      <Header />
      <LiveBanner />
      <HomeSheet />
      {quake !== undefined && (
        <ClientOnly>
          <Suspense fallback={null}>
            <EarthquakePanel quake={quake} />
          </Suspense>
        </ClientOnly>
      )}
    </main>
  );
}
