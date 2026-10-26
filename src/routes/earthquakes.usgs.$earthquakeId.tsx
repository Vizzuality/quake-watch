import { createFileRoute } from '@tanstack/react-router';

import { getUsgsDetailMapModule } from '@/containers/earthquake-detail/usgs/usgs-detail-map-module';
import { UsgsDetailPage } from '@/containers/earthquake-detail/usgs/usgs-detail-page';
import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';
import { isServer } from '@/paraglide/runtime';

export const Route = createFileRoute('/earthquakes/usgs/$earthquakeId')({
  ssr: false,
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(usgsEarthquakeDetailQueryOptions(params.earthquakeId));
    if (!isServer) void getUsgsDetailMapModule().catch(() => undefined);
  },
  component: UsgsDetailRoute,
});

function UsgsDetailRoute() {
  const { earthquakeId } = Route.useParams();
  return <UsgsDetailPage earthquakeId={earthquakeId} />;
}
