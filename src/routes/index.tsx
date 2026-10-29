import { createFileRoute, stripSearchParams } from '@tanstack/react-router';

import { SearchLayout } from '@/containers/search/layout';
import { SearchShell } from '@/containers/search/shell';
import { seedSearchQuery } from '@/lib/earthquakes/search-loader';
import {
  EARTHQUAKE_SEARCH_DEFAULTS,
  earthquakeSearchSchema,
  isDefaultEarthquakeSearch,
} from '@/lib/earthquakes/search-schema';

export const Route = createFileRoute('/')({
  ssr: ({ search }) => search.status === 'success' && isDefaultEarthquakeSearch(search.value),
  validateSearch: earthquakeSearchSchema,
  search: { middlewares: [stripSearchParams(EARTHQUAKE_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => seedSearchQuery(context.queryClient, deps),
  component: SearchLayout,
  pendingComponent: SearchShell,
  pendingMinMs: 0,
});
