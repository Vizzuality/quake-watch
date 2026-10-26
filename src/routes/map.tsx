import { createFileRoute, stripSearchParams } from '@tanstack/react-router';

import { MapLayout } from '@/containers/map/layout';
import { getMapSurfaceModule } from '@/containers/map/map-surface-module';
import {
  EARTHQUAKE_SEARCH_DEFAULTS,
  earthquakeSearchSchema,
} from '@/lib/earthquakes/search-schema';
import { isServer } from '@/paraglide/runtime';

export const Route = createFileRoute('/map')({
  ssr: false,
  validateSearch: earthquakeSearchSchema,
  search: { middlewares: [stripSearchParams(EARTHQUAKE_SEARCH_DEFAULTS)] },
  loader: () => {
    if (!isServer) void getMapSurfaceModule().catch(() => undefined);
  },
  component: MapLayout,
});
