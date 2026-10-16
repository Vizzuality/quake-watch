import type { ExpressionSpecification } from 'maplibre-gl';
import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';

import { useMapPalette } from '@/hooks/use-theme';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import { getWaveFronts } from '@/lib/shakemap/fronts';

const IS_P_WAVE: ExpressionSpecification = ['==', ['get', 'wave'], 'p'];

export function WaveFronts({
  idPrefix,
  epicenter,
  depthKm,
  seconds,
  visible,
}: {
  idPrefix: string;
  epicenter: SearchCenter;
  depthKm: number;
  seconds: number;
  visible: boolean;
}) {
  const palette = useMapPalette();
  const fronts = getWaveFronts(epicenter, depthKm, seconds, visible);
  const epicenterGeoJson = useMemo(
    () => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [epicenter.longitude, epicenter.latitude] },
      properties: {},
    }),
    [epicenter.latitude, epicenter.longitude],
  );

  return (
    <>
      <Source id={`${idPrefix}-fronts`} type="geojson" data={fronts}>
        <Layer
          id={`${idPrefix}-fronts-halo`}
          type="line"
          paint={{
            'line-color': palette.canvas,
            'line-width': ['case', IS_P_WAVE, 3, 5],
            'line-opacity': ['case', IS_P_WAVE, 0.25, 0.45],
          }}
        />
        <Layer
          id={`${idPrefix}-fronts`}
          type="line"
          paint={{
            'line-color': palette.fg,
            'line-width': ['case', IS_P_WAVE, 1, 2.5],
            'line-opacity': ['case', IS_P_WAVE, 0.5, 0.95],
          }}
        />
      </Source>
      <Source id={`${idPrefix}-epicenter`} type="geojson" data={epicenterGeoJson}>
        <Layer
          id={`${idPrefix}-epicenter`}
          type="circle"
          paint={{
            'circle-radius': 5,
            'circle-color': palette.fg,
            'circle-stroke-width': 2,
            'circle-stroke-color': palette.canvas,
          }}
        />
      </Source>
    </>
  );
}
