import { createFileRoute } from '@tanstack/react-router';

import {
  DetailErrorPage,
  DetailNotFoundPage,
} from '@/containers/earthquake-detail/shared/detail-route-states';
import { useDetailHeadRefresh } from '@/containers/earthquake-detail/shared/use-detail-head-refresh';
import { UsgsDetailPage } from '@/containers/earthquake-detail/usgs/usgs-detail-page';
import { getDetailLoaderData } from '@/lib/earthquakes/details/detail-loader';
import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';
import { getDetailMeta } from '@/lib/seo/detail-meta';
import { getLocale } from '@/paraglide/runtime';

export const Route = createFileRoute('/earthquakes/usgs/$earthquakeId')({
  loader: ({ context, params }) => {
    return getDetailLoaderData(
      context.queryClient,
      usgsEarthquakeDetailQueryOptions(params.earthquakeId),
    );
  },
  head: ({ match, loaderData }) => ({
    meta: getDetailMeta({
      status: match.status,
      earthquake: loaderData?.earthquake,
      locale: getLocale(),
    }),
  }),
  component: UsgsDetailRoute,
  notFoundComponent: DetailNotFoundPage,
  errorComponent: UsgsDetailRouteError,
});

function UsgsDetailRoute() {
  const { earthquakeId } = Route.useParams();
  useDetailHeadRefresh({
    routeId: Route.id,
    loaderEarthquake: Route.useLoaderData().earthquake,
    options: usgsEarthquakeDetailQueryOptions(earthquakeId),
  });
  return <UsgsDetailPage earthquakeId={earthquakeId} />;
}

function UsgsDetailRouteError() {
  const { earthquakeId } = Route.useParams();
  const { queryKey } = usgsEarthquakeDetailQueryOptions(earthquakeId);
  return <DetailErrorPage source="usgs" queryKey={queryKey} />;
}
