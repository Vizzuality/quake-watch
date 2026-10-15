import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Datum, DatumList } from '@/components/ui/explainer';
import { Note } from '@/components/ui/note';
import { DetailSection } from '@/containers/earthquake-detail/shared/detail-section';
import { PulseSurface } from '@/containers/earthquake-detail/shared/shaking/pulse-surface';
import { getIntensityShortLabel } from '@/containers/earthquake-detail/shared/shaking/shaking-labels';
import { ShakingLegend } from '@/containers/earthquake-detail/shared/shaking/shaking-legend';
import {
  type ShakingBounds,
  type ShakingReadout,
  ShakingMap,
} from '@/containers/earthquake-detail/shared/shaking/shaking-map';
import {
  ShakingSkeleton,
  WaveSources,
} from '@/containers/earthquake-detail/shared/shaking/shaking-sources';
import { useWavePlayback } from '@/containers/earthquake-detail/shared/shaking/use-wave-playback';
import { WaveFronts } from '@/containers/earthquake-detail/shared/shaking/wave-fronts';
import { WavePlayer } from '@/containers/earthquake-detail/shared/shaking/wave-player';
import { usePageVisible, useViewportVisibility } from '@/hooks/use-visibility';
import type { UsgsShakemapFiles } from '@/lib/earthquakes/details/usgs';
import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import { getDecimalLabel, getKmLabel } from '@/lib/format';
import {
  getGridMaxMmi,
  getShakemapCanvasSize,
  getShakemapCorners,
  getSurfaceRaster,
} from '@/lib/shakemap/canvas';
import { type ShakemapContour, getContourSegments } from '@/lib/shakemap/contours';
import { type ShakemapGrid, getPaletteColor } from '@/lib/shakemap/coverage';
import { getRunDurationSeconds } from '@/lib/shakemap/playback';
import { getSettledSeconds } from '@/lib/shakemap/pulse';
import {
  shakemapContoursQueryOptions,
  shakemapCoverageQueryOptions,
} from '@/lib/shakemap/query-options';
import { getRevealedMmi, getShakemapReveal } from '@/lib/shakemap/readout';
import { getDrawnReachKm, getMaxReachKm } from '@/lib/shakemap/reveal';
import { getWaveDurationSeconds } from '@/lib/shakemap/wave';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import { ShakemapContours } from './shakemap-contours';

const ATTRIBUTION_SOURCE = 'USGS ShakeMap';

type RuptureStart = { epicenter: SearchCenter; depthKm: number };

type ShakemapViewProps = RuptureStart & {
  grid: ShakemapGrid;
  contours: readonly ShakemapContour[];
  isVisible: boolean;
};

function getGridBounds(grid: ShakemapGrid): ShakingBounds {
  return [grid.west, grid.south, grid.east, grid.north];
}

function ShakemapView({ grid, contours, epicenter, depthKm, isVisible }: ShakemapViewProps) {
  const pageVisible = usePageVisible();
  const feltReachKm = useMemo(() => getMaxReachKm(grid, epicenter), [grid, epicenter]);
  const maxMmi = useMemo(() => getGridMaxMmi(grid), [grid]);
  const bounds = useMemo(() => getGridBounds(grid), [grid]);
  const corners = useMemo(() => getShakemapCorners(grid), [grid]);
  const raster = useMemo(
    () =>
      getSurfaceRaster(
        grid,
        getShakemapCanvasSize(grid, Math.max(grid.columns, grid.rows)),
        epicenter,
        depthKm,
      ),
    [grid, epicenter, depthKm],
  );
  const segments = useMemo(
    () => getContourSegments(contours, epicenter, depthKm),
    [contours, epicenter, depthKm],
  );
  const durationSeconds = useMemo(
    () =>
      getRunDurationSeconds(
        Math.max(
          getWaveDurationSeconds(getDrawnReachKm(grid, contours, epicenter), depthKm),
          getSettledSeconds(raster),
        ),
      ),
    [grid, contours, epicenter, depthKm, raster],
  );
  const { seconds, complete, playing, toggle, seek } = useWavePlayback({
    durationSeconds,
    canAutoplay: isVisible,
    canAnimate: isVisible && pageVisible,
  });
  const reveal = getShakemapReveal(epicenter, depthKm, seconds, complete);
  const locale = getLocale();

  function getReadout(point: SearchCenter): ShakingReadout | null {
    const mmi = getRevealedMmi(grid, reveal, point);
    if (mmi === null) return null;
    return {
      color: getPaletteColor(grid.palette, mmi),
      text: m.detail_shakemap_readout({ intensity: getIntensityShortLabel(mmi, locale) }),
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <ShakingMap
        label={m.detail_shakemap_map_label()}
        attribution={m.attribution_data({ source: ATTRIBUTION_SOURCE })}
        bounds={bounds}
        getReadout={getReadout}
      >
        <PulseSurface
          id="shakemap-surface"
          corners={corners}
          raster={raster}
          seconds={seconds}
          settled={complete}
        />
        <ShakemapContours segments={segments} seconds={seconds} settled={complete} />
        <WaveFronts
          idPrefix="shakemap"
          epicenter={epicenter}
          depthKm={depthKm}
          seconds={seconds}
          visible={!complete}
        />
      </ShakingMap>
      <WavePlayer
        seconds={seconds}
        durationSeconds={durationSeconds}
        playing={playing}
        onToggle={toggle}
        onSeek={seek}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ShakingLegend palette={grid.palette}>
          <p>{m.detail_shakemap_legend_lines()}</p>
        </ShakingLegend>
        <DatumList>
          <Datum
            label={m.detail_shakemap_label_felt_reach()}
            value={getKmLabel(feltReachKm, locale)}
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
  isVisible,
  ...ruptureStart
}: RuptureStart & { files: UsgsShakemapFiles; isVisible: boolean }) {
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
  if (!coverage.data || !contours.data) return <ShakingSkeleton />;
  return (
    <ShakemapView
      grid={coverage.data}
      contours={contours.data}
      isVisible={isVisible}
      {...ruptureStart}
    />
  );
}

function ShakemapContent({ files, ...ruptureStart }: RuptureStart & { files: UsgsShakemapFiles }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isVisible, hasBeenVisible } = useViewportVisibility(containerRef);

  return (
    <div ref={containerRef}>
      {hasBeenVisible ? (
        <ShakemapBody
          key={files.coverageUrl}
          files={files}
          isVisible={isVisible}
          {...ruptureStart}
        />
      ) : (
        <ShakingSkeleton />
      )}
    </div>
  );
}

function ShakemapExplainer() {
  return (
    <>
      <p>{m.detail_shakemap_explainer_what()}</p>
      <p>{m.detail_shakemap_explainer_ground()}</p>
      <p>{m.detail_shakemap_explainer_data()}</p>
      <p>{m.detail_shakemap_explainer_estimate()}</p>
      <p>{m.detail_shakemap_explainer_waves()}</p>
      <p>{m.detail_shakemap_explainer_real()}</p>
      <p>{m.detail_shakemap_explainer_recreated()}</p>
      <WaveSources />
    </>
  );
}

export function UsgsShakemapSection({ earthquakeId }: { earthquakeId: string }) {
  const { data } = useQuery(usgsEarthquakeDetailQueryOptions(earthquakeId));
  const latitude = data?.earthquake.latitude ?? 0;
  const longitude = data?.earthquake.longitude ?? 0;
  const epicenter = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  if (!data) return null;

  if (!data.shakemap) {
    return (
      <DetailSection
        title={m.detail_shakemap_title()}
        explainer={<p>{m.detail_shakemap_none_explain()}</p>}
      >
        <Note>{m.detail_shakemap_none()}</Note>
      </DetailSection>
    );
  }
  return (
    <DetailSection title={m.detail_shakemap_title()} explainer={<ShakemapExplainer />}>
      <ShakemapContent
        files={data.shakemap}
        epicenter={epicenter}
        depthKm={data.earthquake.depthKm}
      />
    </DetailSection>
  );
}
