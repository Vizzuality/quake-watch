import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Datum, DatumList } from '@/components/ui/explainer';
import { Skeleton } from '@/components/ui/skeleton';
import { DetailSection } from '@/containers/earthquake-detail/shared/detail-section';
import { usePageVisible, useViewportVisibility } from '@/hooks/use-visibility';
import type { UsgsShakemapFiles } from '@/lib/earthquakes/details/usgs';
import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import { getDecimalLabel, getKmLabel } from '@/lib/format';
import { getGridMaxMmi } from '@/lib/shakemap/canvas';
import type { ShakemapContour } from '@/lib/shakemap/contours';
import type { ShakemapGrid } from '@/lib/shakemap/coverage';
import {
  shakemapContoursQueryOptions,
  shakemapCoverageQueryOptions,
} from '@/lib/shakemap/query-options';
import { getShakemapReveal } from '@/lib/shakemap/readout';
import { getMaxReachKm } from '@/lib/shakemap/reveal';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import { getIntensityShortLabel } from './shakemap-labels';
import { ShakemapLegend } from './shakemap-legend';
import { ShakemapMap } from './shakemap-map';
import { ShakemapPlayer } from './shakemap-player';
import { useShakemapPlayback } from './use-shakemap-playback';

type ShakemapViewProps = {
  grid: ShakemapGrid;
  contours: readonly ShakemapContour[];
  epicenter: SearchCenter;
  isVisible: boolean;
};

function ShakemapSkeleton() {
  return (
    <div className="flex flex-col gap-3" data-testid="shakemap-skeleton">
      <Skeleton className="h-80 w-full rounded-lg sm:h-[28rem]" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

function ShakemapView({ grid, contours, epicenter, isVisible }: ShakemapViewProps) {
  const pageVisible = usePageVisible();
  const maxReachKm = useMemo(() => getMaxReachKm(grid, epicenter), [grid, epicenter]);
  const maxMmi = useMemo(() => getGridMaxMmi(grid), [grid]);
  const { progress, playing, toggle, seek } = useShakemapPlayback({
    canAutoplay: isVisible,
    canAnimate: isVisible && pageVisible,
  });
  const reveal = useMemo(
    () => getShakemapReveal(epicenter, progress, maxReachKm),
    [epicenter, progress, maxReachKm],
  );
  const locale = getLocale();

  return (
    <div className="flex flex-col gap-4">
      <ShakemapMap grid={grid} contours={contours} reveal={reveal} />
      <ShakemapPlayer
        progress={progress}
        playing={playing}
        radiusKm={reveal.radiusKm}
        maxReachKm={maxReachKm}
        onToggle={toggle}
        onSeek={seek}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ShakemapLegend palette={grid.palette} />
        <DatumList>
          <Datum
            label={m.detail_shakemap_label_felt_reach()}
            value={getKmLabel(maxReachKm, locale)}
            explanation={m.detail_shakemap_felt_reach_explain()}
          />
          {maxMmi === null ? null : (
            <Datum
              label={m.detail_shakemap_label_strongest()}
              value={`${getIntensityShortLabel(maxMmi, locale)} (${getDecimalLabel(maxMmi, locale, 1)})`}
              explanation={m.detail_shakemap_strongest_explain()}
            />
          )}
        </DatumList>
      </div>
    </div>
  );
}

function ShakemapBody({
  files,
  epicenter,
  isVisible,
}: {
  files: UsgsShakemapFiles;
  epicenter: SearchCenter;
  isVisible: boolean;
}) {
  const coverage = useQuery(shakemapCoverageQueryOptions(files.coverageUrl));
  const contours = useQuery(shakemapContoursQueryOptions(files.contoursUrl));

  function handleRetry() {
    if (coverage.isError) coverage.refetch();
    if (contours.isError) contours.refetch();
  }

  if (coverage.isError || contours.isError) {
    return (
      <Alert
        action={
          <Button size="sm" onClick={handleRetry}>
            {m.retry()}
          </Button>
        }
      >
        {m.detail_shakemap_error()}
      </Alert>
    );
  }
  if (!coverage.data || !contours.data) return <ShakemapSkeleton />;
  return (
    <ShakemapView
      grid={coverage.data}
      contours={contours.data}
      epicenter={epicenter}
      isVisible={isVisible}
    />
  );
}

function ShakemapContent({
  files,
  epicenter,
}: {
  files: UsgsShakemapFiles;
  epicenter: SearchCenter;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isVisible, hasBeenVisible } = useViewportVisibility(containerRef);

  return (
    <div ref={containerRef}>
      {hasBeenVisible ? (
        <ShakemapBody
          key={files.coverageUrl}
          files={files}
          epicenter={epicenter}
          isVisible={isVisible}
        />
      ) : (
        <ShakemapSkeleton />
      )}
    </div>
  );
}

export function UsgsShakemapSection({ earthquakeId }: { earthquakeId: string }) {
  const { data } = useQuery(usgsEarthquakeDetailQueryOptions(earthquakeId));
  const latitude = data?.earthquake.latitude ?? 0;
  const longitude = data?.earthquake.longitude ?? 0;
  const epicenter = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  if (!data?.shakemap) return null;

  return (
    <DetailSection
      title={m.detail_shakemap_title()}
      explainer={
        <>
          <p>{m.detail_shakemap_explainer_what()}</p>
          <p>{m.detail_shakemap_explainer_ground()}</p>
          <p>{m.detail_shakemap_explainer_data()}</p>
          <p>{m.detail_shakemap_explainer_estimate()}</p>
          <p>{m.detail_shakemap_explainer_wave()}</p>
        </>
      }
    >
      <ShakemapContent files={data.shakemap} epicenter={epicenter} />
    </DetailSection>
  );
}
