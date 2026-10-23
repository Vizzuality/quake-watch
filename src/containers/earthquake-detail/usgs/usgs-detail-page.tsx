import { useQuery } from '@tanstack/react-query';

import { CrustalBlockSection } from '@/containers/earthquake-detail/crustal-block/crustal-block-section';
import { DetailError } from '@/containers/earthquake-detail/shared/detail-error';
import { DetailHeader } from '@/containers/earthquake-detail/shared/detail-header';
import { DetailLayout } from '@/containers/earthquake-detail/shared/detail-layout';
import { DetailNotFound } from '@/containers/earthquake-detail/shared/detail-not-found';
import { DetailSkeleton } from '@/containers/earthquake-detail/shared/detail-skeleton';
import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';

import { UsgsDetailMap } from './usgs-detail-map';
import { UsgsImpactSection } from './usgs-impact-section';
import { UsgsMechanismSection } from './usgs-mechanism-section';
import { UsgsOriginSection } from './usgs-origin-section';
import { UsgsSummarySection } from './usgs-summary-section';

function UsgsDetailBody({ earthquakeId }: { earthquakeId: string }) {
  const { data, status, refetch } = useQuery(usgsEarthquakeDetailQueryOptions(earthquakeId));

  if (status === 'pending') return <DetailSkeleton />;
  if (status === 'error')
    return <DetailError sourceLabel={SOURCE_ADAPTERS.usgs.label} onRetry={() => refetch()} />;
  if (data === null) return <DetailNotFound />;

  const { earthquake } = data;
  return (
    <div className="flex flex-col gap-12">
      <DetailHeader earthquake={earthquake} />
      <div className="grid gap-6 lg:grid-cols-2">
        <UsgsDetailMap earthquakeId={earthquakeId} />
        <UsgsSummarySection earthquakeId={earthquakeId} />
      </div>
      <CrustalBlockSection
        latitude={earthquake.latitude}
        longitude={earthquake.longitude}
        depthKm={earthquake.depthKm}
      />
      <UsgsOriginSection earthquakeId={earthquakeId} />
      <UsgsImpactSection earthquakeId={earthquakeId} />
      <UsgsMechanismSection earthquakeId={earthquakeId} />
    </div>
  );
}

export function UsgsDetailPage({ earthquakeId }: { earthquakeId: string }) {
  return (
    <DetailLayout>
      <UsgsDetailBody earthquakeId={earthquakeId} />
    </DetailLayout>
  );
}
