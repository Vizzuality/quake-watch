import { useQuery } from '@tanstack/react-query';
import { useId, useMemo } from 'react';

import { DetailMinimap } from '@/containers/earthquake-detail/shared/detail-minimap';
import {
  getIntensityShortLabel,
  getSwatchClassName,
} from '@/containers/earthquake-detail/shared/shaking/shaking-labels';
import { WaveSources } from '@/containers/earthquake-detail/shared/shaking/shaking-sources';
import { WaveTrainMap } from '@/containers/earthquake-detail/shared/shaking/wave-train-map';
import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';
import { getDecimalLabel } from '@/lib/format';
import { shakemapContoursQueryOptions } from '@/lib/shakemap/query-options';
import {
  type IsoseismalProfile,
  getTrainBounds,
  getWaveTrainShape,
} from '@/lib/shakemap/wave-train';
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

function IsoseismalLegend({ profiles }: { profiles: readonly IsoseismalProfile[] }) {
  const titleId = useId();
  const locale = getLocale();

  return (
    <>
      <p id={titleId} className="font-medium">
        {m.detail_train_isoseismals_title()}
      </p>
      <ul aria-labelledby={titleId} className="flex flex-col gap-1.5">
        {profiles.map(({ mmi, color }) => (
          <li key={mmi} className="flex items-center gap-2">
            <span
              aria-hidden
              className={getSwatchClassName(false)}
              style={{ backgroundColor: color }}
            />
            {getIntensityShortLabel(mmi, locale)} ({getDecimalLabel(mmi, locale, 1)})
          </li>
        ))}
      </ul>
      <p>{m.detail_train_usgs_real()}</p>
      <p>{m.detail_train_usgs_recreated()}</p>
      <WaveSources />
    </>
  );
}

function CircleLegend() {
  return (
    <>
      <p>{m.detail_train_circle_recreated()}</p>
      <WaveSources />
    </>
  );
}

export function UsgsDetailMap({ earthquakeId }: { earthquakeId: string }) {
  const detail = useQuery(usgsEarthquakeDetailQueryOptions(earthquakeId));
  const earthquake = detail.data?.earthquake;
  const contoursUrl = detail.data?.shakemap?.contoursUrl;
  const contours = useQuery(shakemapContoursQueryOptions(contoursUrl));
  const isSettled = contoursUrl === undefined || contours.status !== 'pending';
  const shape = useMemo(
    () => (earthquake && isSettled ? getWaveTrainShape(contours.data ?? null, earthquake) : null),
    [earthquake, isSettled, contours.data],
  );
  const bounds = useMemo(
    () => (earthquake && shape ? getTrainBounds(shape, earthquake) : null),
    [earthquake, shape],
  );

  if (!earthquake) return null;
  if (!shape) return <DetailMinimap earthquake={earthquake} />;

  return (
    <WaveTrainMap
      earthquake={earthquake}
      shape={shape}
      bounds={bounds}
      legend={
        shape.kind === 'isoseismal' ? (
          <IsoseismalLegend profiles={shape.profiles} />
        ) : (
          <CircleLegend />
        )
      }
    />
  );
}
