import { createFileRoute, stripSearchParams } from '@tanstack/react-router';

import { MapLayout } from '@/containers/map/layout';
import { MapShell } from '@/containers/map/shell';
import { prefetchSearchQuery } from '@/lib/earthquakes/search-loader';
import {
  EARTHQUAKE_SEARCH_DEFAULTS,
  earthquakeSearchSchema,
} from '@/lib/earthquakes/search-schema';

export const Route = createFileRoute('/map')({
  ssr: false,
  validateSearch: earthquakeSearchSchema,
  search: { middlewares: [stripSearchParams(EARTHQUAKE_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, preload }) =>
    prefetchSearchQuery(context.queryClient, deps, { preload }),
  component: MapLayout,
  pendingComponent: MapShell,
  pendingMinMs: 0,
});
