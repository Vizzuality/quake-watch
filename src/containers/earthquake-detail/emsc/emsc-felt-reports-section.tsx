import { useQuery } from '@tanstack/react-query';
import type { MapGeoJSONFeature } from 'maplibre-gl';
import { useMemo, useRef } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Datum, DatumList } from '@/components/ui/explainer';
import { Note } from '@/components/ui/note';
import { DetailSection } from '@/containers/earthquake-detail/shared/detail-section';
import { getIntensityShortLabel } from '@/containers/earthquake-detail/shared/shaking/shaking-labels';
import { ShakingLegend } from '@/containers/earthquake-detail/shared/shaking/shaking-legend';
import {
  type ShakingReadout,
  ShakingMap,
} from '@/containers/earthquake-detail/shared/shaking/shaking-map';
import {
  ShakingSkeleton,
  SourceLink,
  WaveSources,
} from '@/containers/earthquake-detail/shared/shaking/shaking-sources';
import { useWavePlayback } from '@/containers/earthquake-detail/shared/shaking/use-wave-playback';
import { WaveFronts } from '@/containers/earthquake-detail/shared/shaking/wave-fronts';
import { WavePlayer } from '@/containers/earthquake-detail/shared/shaking/wave-player';
import { usePageVisible, useViewportVisibility } from '@/hooks/use-visibility';
import { emscEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/emsc-query-options';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import {
  getBubbleFeatures,
  getBubbleMmi,
  getBubbleProperties,
  getFramedRunEndSeconds,
  getIsBubbleArrived,
  getStrongestCell,
} from '@/lib/felt-reports/bubbles';
import type { FeltReportCell } from '@/lib/felt-reports/cells';
import { getFeltReportsViewBounds } from '@/lib/felt-reports/framing';
import { FELT_REPORTS_PALETTE } from '@/lib/felt-reports/palette';
import { feltReportsQueryOptions } from '@/lib/felt-reports/query-options';
import { getDecimalLabel } from '@/lib/format';
import { getPaletteColor } from '@/lib/shakemap/coverage';
import { getRunDurationSeconds } from '@/lib/shakemap/playback';
import { m } from '@/paraglide/messages';
import { type Locale, getLocale } from '@/paraglide/runtime';

import { BUBBLE_LAYER_ID, FeltReportBubbles } from './felt-report-bubbles';
import { getFeltReadoutText, getFeltStrongestText } from './felt-reports-labels';
import { FeltReportsSizeKey } from './felt-reports-size-key';

const ATTRIBUTION_SOURCE = 'EMSC-CSEM, CC BY 4.0';
const EMSC_DOCS_URL = 'https://www.seismicportal.eu/testimonies-ws/';
const EMSC_METHOD_URL = 'https://doi.org/10.5281/zenodo.12570295';
const USGS_SCALE_URL =
  'https://www.usgs.gov/programs/earthquake-hazards/modified-mercalli-intensity-scale';
const FILL_FROM_MMI = 1;
const INTERACTIVE_LAYER_IDS = [BUBBLE_LAYER_ID];

type RuptureStart = { epicenter: SearchCenter; depthKm: number };

function getTotalReports(cells: readonly FeltReportCell[]): number {
  return cells.reduce((total, { count }) => total + count, 0);
}

function getStrongestText(cells: readonly FeltReportCell[], locale: Locale): string {
  const strongest = getStrongestCell(cells);
  if (!strongest) return '';
  return getFeltStrongestText(
    getIntensityShortLabel(strongest.mmi, locale),
    strongest.count,
    locale,
  );
}

function FeltReportsView({
  cells,
  epicenter,
  depthKm,
  isVisible,
}: RuptureStart & { cells: readonly FeltReportCell[]; isVisible: boolean }) {
  const pageVisible = usePageVisible();
  const locale = getLocale();
  const bubbles = useMemo(
    () => getBubbleFeatures(cells, epicenter, depthKm),
    [cells, epicenter, depthKm],
  );
  const viewBounds = useMemo(() => getFeltReportsViewBounds(cells, epicenter), [cells, epicenter]);
  const durationSeconds = useMemo(
    () => getRunDurationSeconds(getFramedRunEndSeconds(cells, epicenter, depthKm)),
    [cells, epicenter, depthKm],
  );
  const { seconds, complete, playing, toggle, seek } = useWavePlayback({
    durationSeconds,
    canAutoplay: isVisible,
    canAnimate: isVisible && pageVisible,
  });

  function getReadout(
    _point: SearchCenter,
    features: readonly MapGeoJSONFeature[],
  ): ShakingReadout | null {
    const bubble = features
      .map(({ properties }) => getBubbleProperties(properties))
      .find(
        (properties) => properties !== null && getIsBubbleArrived(properties, seconds, complete),
      );
    if (!bubble) return null;
    const mmi = getBubbleMmi(bubble);
    return {
      color: getPaletteColor(FELT_REPORTS_PALETTE, mmi),
      text: getFeltReadoutText(getIntensityShortLabel(mmi, locale), bubble.reports, locale),
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <ShakingMap
        label={m.detail_felt_map_label()}
        attribution={m.attribution_data({ source: ATTRIBUTION_SOURCE })}
        bounds={viewBounds}
        getReadout={getReadout}
        interactiveLayerIds={INTERACTIVE_LAYER_IDS}
      >
        <FeltReportBubbles data={bubbles} seconds={seconds} complete={complete} locale={locale} />
        <WaveFronts
          idPrefix="felt"
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
        <ShakingLegend
          palette={FELT_REPORTS_PALETTE}
          fillFromMmi={FILL_FROM_MMI}
          title={m.detail_felt_legend_title()}
        >
          <p>{m.detail_felt_legend_cells()}</p>
          <FeltReportsSizeKey />
        </ShakingLegend>
        <DatumList>
          <Datum
            label={m.detail_felt_label_reports()}
            value={getDecimalLabel(getTotalReports(cells), locale)}
            explanation={m.detail_felt_reports_explain()}
          />
          <Datum
            label={m.detail_felt_label_strongest()}
            value={getStrongestText(cells, locale)}
            explanation={m.detail_felt_strongest_explain()}
          />
        </DatumList>
      </div>
    </div>
  );
}

function FeltReportsContent({
  earthquakeId,
  ...ruptureStart
}: RuptureStart & { earthquakeId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isVisible, hasBeenVisible } = useViewportVisibility(containerRef);
  const reports = useQuery({ ...feltReportsQueryOptions(earthquakeId), enabled: hasBeenVisible });

  function renderBody() {
    if (reports.isError) {
      return (
        <Alert
          action={
            <Button size="sm" onClick={() => reports.refetch()}>
              {m.retry()}
            </Button>
          }
        >
          {m.detail_felt_error()}
        </Alert>
      );
    }
    if (!reports.data) return <ShakingSkeleton />;
    if (reports.data.length === 0) return <Note>{m.detail_felt_none()}</Note>;
    return <FeltReportsView cells={reports.data} isVisible={isVisible} {...ruptureStart} />;
  }

  return <div ref={containerRef}>{renderBody()}</div>;
}

function FeltReportsExplainer() {
  return (
    <>
      <p>{m.detail_felt_explainer_what()}</p>
      <p>{m.detail_felt_explainer_cells()}</p>
      <p>{m.detail_felt_explainer_correction()}</p>
      <p>{m.detail_felt_explainer_preliminary()}</p>
      <p>{m.detail_felt_explainer_colors()}</p>
      <p>{m.detail_shakemap_explainer_waves()}</p>
      <p>{m.detail_felt_explainer_real()}</p>
      <p>{m.detail_felt_explainer_recreated()}</p>
      <p>
        {m.detail_felt_explainer_source()}{' '}
        <SourceLink href={EMSC_DOCS_URL}>{m.detail_felt_source_link()}</SourceLink>
        {' · '}
        <SourceLink href={EMSC_METHOD_URL}>{m.detail_felt_source_link_method()}</SourceLink>
        {' · '}
        <SourceLink href={USGS_SCALE_URL}>{m.detail_felt_source_link_scale()}</SourceLink>
      </p>
      <WaveSources />
    </>
  );
}

export function EmscFeltReportsSection({ earthquakeId }: { earthquakeId: string }) {
  const { data } = useQuery(emscEarthquakeDetailQueryOptions(earthquakeId));
  const latitude = data?.earthquake.latitude ?? 0;
  const longitude = data?.earthquake.longitude ?? 0;
  const epicenter = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);
  if (!data) return null;

  return (
    <DetailSection title={m.detail_felt_title()} explainer={<FeltReportsExplainer />}>
      <FeltReportsContent
        key={earthquakeId}
        earthquakeId={earthquakeId}
        epicenter={epicenter}
        depthKm={data.earthquake.depthKm}
      />
    </DetailSection>
  );
}
