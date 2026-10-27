import { createFileRoute } from '@tanstack/react-router';

import { EmscDetailPage } from '@/containers/earthquake-detail/emsc/emsc-detail-page';
import {
  DetailErrorPage,
  DetailNotFoundPage,
} from '@/containers/earthquake-detail/shared/detail-route-states';
import { getDetailLoaderData } from '@/lib/earthquakes/details/detail-loader';
import { emscEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/emsc-query-options';
import { getDetailMeta } from '@/lib/seo/detail-meta';
import { getLocale } from '@/paraglide/runtime';

export const Route = createFileRoute('/earthquakes/emsc/$earthquakeId')({
  loader: ({ context, params }) => {
    return getDetailLoaderData(
      context.queryClient,
      emscEarthquakeDetailQueryOptions(params.earthquakeId),
    );
  },
  head: ({ match, loaderData }) => ({
    meta: getDetailMeta({
      status: match.status,
      earthquake: loaderData?.earthquake,
      locale: getLocale(),
    }),
  }),
  component: EmscDetailRoute,
  notFoundComponent: DetailNotFoundPage,
  errorComponent: EmscDetailRouteError,
});

function EmscDetailRoute() {
  const { earthquakeId } = Route.useParams();
  return <EmscDetailPage earthquakeId={earthquakeId} />;
}

function EmscDetailRouteError() {
  const { earthquakeId } = Route.useParams();
  const { queryKey } = emscEarthquakeDetailQueryOptions(earthquakeId);
  return <DetailErrorPage source="emsc" queryKey={queryKey} />;
}
