import { createFileRoute } from '@tanstack/react-router';

import { getEmscDetailMapModule } from '@/containers/earthquake-detail/emsc/emsc-detail-map-module';
import { EmscDetailPage } from '@/containers/earthquake-detail/emsc/emsc-detail-page';
import { emscEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/emsc-query-options';
import { isServer } from '@/paraglide/runtime';

export const Route = createFileRoute('/earthquakes/emsc/$earthquakeId')({
  ssr: false,
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(emscEarthquakeDetailQueryOptions(params.earthquakeId));
    if (!isServer) void getEmscDetailMapModule().catch(() => undefined);
  },
  component: EmscDetailRoute,
});

function EmscDetailRoute() {
  const { earthquakeId } = Route.useParams();
  return <EmscDetailPage earthquakeId={earthquakeId} />;
}
