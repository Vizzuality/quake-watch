import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { DetailMinimap } from '@/containers/earthquake-detail/shared/detail-minimap';
import { WaveTrainMap } from '@/containers/earthquake-detail/shared/shaking/wave-train-map';
import { emscEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/emsc-query-options';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getBubbleFeatures } from '@/lib/felt-reports/bubbles';
import type { FeltReportCell } from '@/lib/felt-reports/cells';
import { getFarthestCellKm, getFeltReportsViewBounds } from '@/lib/felt-reports/framing';
import { feltReportsQueryOptions } from '@/lib/felt-reports/query-options';
import {
  type TrainBounds,
  getMergedBounds,
  getTrainBounds,
  getWaveTrainShape,
} from '@/lib/shakemap/wave-train';
import { getLocale } from '@/paraglide/runtime';

import { FeltReportBubbles } from './felt-report-bubbles';
import { FeltReportsLegend } from './felt-reports-legend';

const NO_CELLS: readonly FeltReportCell[] = [];

function getFramedBounds(
  earthquake: Earthquake,
  cells: readonly FeltReportCell[],
  circleBounds: TrainBounds | null,
): TrainBounds | null {
  if (cells.length === 0) return circleBounds;
  const feltBounds = getFeltReportsViewBounds(cells, earthquake);
  return circleBounds ? getMergedBounds(feltBounds, circleBounds) : feltBounds;
}

export function EmscDetailMap({ earthquakeId }: { earthquakeId: string }) {
  const detail = useQuery(emscEarthquakeDetailQueryOptions(earthquakeId));
  const reports = useQuery(feltReportsQueryOptions(earthquakeId));
  const locale = getLocale();
  const earthquake = detail.data?.earthquake;
  const cells = reports.data ?? NO_CELLS;
  const observedReachKm = useMemo(
    () => (earthquake ? getFarthestCellKm(cells, earthquake) : 0),
    [earthquake, cells],
  );
  const shape = useMemo(
    () => (earthquake ? getWaveTrainShape(null, earthquake, observedReachKm) : null),
    [earthquake, observedReachKm],
  );
  const bounds = useMemo(
    () =>
      earthquake && shape
        ? getFramedBounds(earthquake, cells, getTrainBounds(shape, earthquake))
        : null,
    [earthquake, shape, cells],
  );
  const bubbles = useMemo(() => getBubbleFeatures(cells), [cells]);

  if (!earthquake || !shape) return null;
  if (reports.isPending) return <DetailMinimap earthquake={earthquake} />;

  return (
    <WaveTrainMap
      earthquake={earthquake}
      shape={shape}
      bounds={bounds}
      legend={
        <FeltReportsLegend
          hasReports={cells.length > 0}
          isObserved={shape.kind === 'circle' && shape.observed}
        />
      }
    >
      {cells.length > 0 ? <FeltReportBubbles data={bubbles} locale={locale} /> : null}
    </WaveTrainMap>
  );
}
