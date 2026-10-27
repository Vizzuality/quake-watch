import { createFileRoute } from '@tanstack/react-router';

import { EmscDetailPage } from '@/containers/earthquake-detail/emsc/emsc-detail-page';
import { emscEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/emsc-query-options';

export const Route = createFileRoute('/earthquakes/emsc/$earthquakeId')({
  ssr: false,
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(emscEarthquakeDetailQueryOptions(params.earthquakeId));
  },
  component: EmscDetailRoute,
});

function EmscDetailRoute() {
  const { earthquakeId } = Route.useParams();
  return <EmscDetailPage earthquakeId={earthquakeId} />;
}
