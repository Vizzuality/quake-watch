import { useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';

import { DetailError } from '@/containers/earthquake-detail/shared/detail-error';
import { DetailLayout } from '@/containers/earthquake-detail/shared/detail-layout';
import { DetailNotFound } from '@/containers/earthquake-detail/shared/detail-not-found';
import { ErrorComponent } from '@/containers/errors/error-component';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';
import type { EarthquakeSource } from '@/lib/earthquakes/search-schema';

export function DetailNotFoundPage() {
  return (
    <DetailLayout>
      <DetailNotFound />
    </DetailLayout>
  );
}

function DetailUpstreamErrorPage({ source }: { source: EarthquakeSource }) {
  const router = useRouter();

  return (
    <DetailLayout>
      <DetailError
        sourceLabel={SOURCE_ADAPTERS[source].label}
        onRetry={() => void router.invalidate()}
      />
    </DetailLayout>
  );
}

export function DetailErrorPage({
  source,
  queryKey,
}: {
  source: EarthquakeSource;
  queryKey: QueryKey;
}) {
  const queryClient = useQueryClient();
  if (queryClient.getQueryState(queryKey)?.status !== 'error') return <ErrorComponent />;
  return <DetailUpstreamErrorPage source={source} />;
}
