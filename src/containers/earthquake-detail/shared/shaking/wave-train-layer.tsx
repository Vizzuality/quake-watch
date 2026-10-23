import { Layer, Source } from 'react-map-gl/maplibre';

import { useMapPalette } from '@/hooks/use-theme';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import { type WaveTrainShape, getTrainFronts } from '@/lib/shakemap/wave-train';

import { useWaveClock } from './use-wave-loop';

export function WaveTrainLayer({
  shape,
  epicenter,
  running,
  frozen,
}: {
  shape: WaveTrainShape;
  epicenter: SearchCenter;
  running: boolean;
  frozen: boolean;
}) {
  const palette = useMapPalette();
  const elapsedMs = useWaveClock(running, frozen);
  const fronts = getTrainFronts(shape, epicenter, elapsedMs);

  return (
    <Source id="wave-train" type="geojson" data={fronts}>
      <Layer
        id="wave-train-halo"
        type="line"
        layout={{ 'line-join': 'round', 'line-cap': 'butt' }}
        paint={{
          'line-color': palette.canvas,
          'line-width': 5,
          'line-opacity': ['*', ['get', 'opacity'], 0.4],
        }}
      />
      <Layer
        id="wave-train-line"
        type="line"
        layout={{ 'line-join': 'round', 'line-cap': 'butt' }}
        paint={{
          'line-color': ['coalesce', ['get', 'color'], palette.fg],
          'line-width': 2.5,
          'line-opacity': ['get', 'opacity'],
        }}
      />
    </Source>
  );
}
