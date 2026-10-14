import { useQuery } from '@tanstack/react-query';

import { CrustalBlockSection } from '@/containers/earthquake-detail/crustal-block/crustal-block-section';
import { DetailError } from '@/containers/earthquake-detail/shared/detail-error';
import { DetailHeader } from '@/containers/earthquake-detail/shared/detail-header';
import { DetailLayout } from '@/containers/earthquake-detail/shared/detail-layout';
import { DetailMinimap } from '@/containers/earthquake-detail/shared/detail-minimap';
import { DetailNotFound } from '@/containers/earthquake-detail/shared/detail-not-found';
import { DetailSkeleton } from '@/containers/earthquake-detail/shared/detail-skeleton';
import { emscEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/emsc-query-options';
import { SOURCE_ADAPTERS } from '@/lib/earthquakes/query-options';

import { EmscOriginSection } from './emsc-origin-section';
import { EmscSummarySection } from './emsc-summary-section';

function EmscDetailBody({ earthquakeId }: { earthquakeId: string }) {
  const { data, status, refetch } = useQuery(emscEarthquakeDetailQueryOptions(earthquakeId));

  if (status === 'pending') return <DetailSkeleton />;
  if (status === 'error')
    return <DetailError sourceLabel={SOURCE_ADAPTERS.emsc.label} onRetry={() => refetch()} />;
  if (data === null) return <DetailNotFound />;

  const { earthquake } = data;
  return (
    <div className="flex flex-col gap-8">
      <DetailHeader earthquake={earthquake} />
      <div className="grid gap-6 lg:grid-cols-2">
        <DetailMinimap earthquake={earthquake} />
        <EmscSummarySection earthquakeId={earthquakeId} />
      </div>
      <CrustalBlockSection
        latitude={earthquake.latitude}
        longitude={earthquake.longitude}
        depthKm={earthquake.depthKm}
      />
      <EmscOriginSection earthquakeId={earthquakeId} />
    </div>
  );
}

export function EmscDetailPage({ earthquakeId }: { earthquakeId: string }) {
  return (
    <DetailLayout>
      <EmscDetailBody earthquakeId={earthquakeId} />
    </DetailLayout>
  );
}
