import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { GlobeSlot } from '@/containers/globe/globe-slot';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { EARTHQUAKE_SEARCH_ROUTE, getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';
import { isServer } from '@/paraglide/runtime';

const Globe = lazy(() => import('@/containers/globe/globe'));

export const Route = createFileRoute('/')({
  ...EARTHQUAKE_SEARCH_ROUTE,
  loaderDeps: ({ search }) => getEarthquakeFilters(search),
  loader: ({ context, deps, preload }) => {
    if (preload || isServer) return;
    void context.queryClient.prefetchQuery(earthquakesQueryOptions(deps));
  },
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
  const { source, interval, minmag, depth } = search;

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-background text-foreground"
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
    </main>
  );
}
