import { createFileRoute } from '@tanstack/react-router';

import { UsgsDetailPage } from '@/containers/earthquake-detail/usgs/usgs-detail-page';
import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';

export const Route = createFileRoute('/earthquakes/usgs/$earthquakeId')({
  ssr: false,
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(usgsEarthquakeDetailQueryOptions(params.earthquakeId));
  },
  component: UsgsDetailRoute,
});

function UsgsDetailRoute() {
  const { earthquakeId } = Route.useParams();
  return <UsgsDetailPage earthquakeId={earthquakeId} />;
}
