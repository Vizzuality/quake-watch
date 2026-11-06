import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { Wordmark } from '@/components/brand/wordmark';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { EARTHQUAKE_SEARCH_ROUTE, getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';
import { isServer } from '@/paraglide/runtime';

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
      className="grid min-h-dvh place-items-center bg-background text-foreground"
      data-source={source}
      data-interval={interval}
      data-minmag={minmag}
      data-depth={depth}
    >
      <h1 className="sr-only">{m.app_title()}</h1>
      <Wordmark />
    </main>
  );
}
