import type { CanvasSource } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import type { ShakemapCorners } from '@/lib/shakemap/canvas';
import { type PulseRaster, getPulseFrameBuffer, paintPulseFrame } from '@/lib/shakemap/pulse';

import { getShakingBeforeId, placeOnStyle } from './map-layers';

function getRasterCanvas({ width, height }: PulseRaster): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function PulseSurface({
  id,
  corners,
  raster,
  seconds,
  settled,
}: {
  id: string;
  corners: ShakemapCorners;
  raster: PulseRaster;
  seconds: number;
  settled: boolean;
}) {
  const { current: map } = useMap();
  const canvas = useMemo(() => getRasterCanvas(raster), [raster]);
  const frame = useMemo(
    () => new ImageData(getPulseFrameBuffer(raster), raster.width, raster.height),
    [raster],
  );

  useEffect(() => {
    if (!map) return;
    const instance = map.getMap();
    const stopPlacing = placeOnStyle(instance, () => {
      if (!instance.getSource(id)) {
        instance.addSource(id, { type: 'canvas', canvas, coordinates: corners, animate: false });
      }
      if (instance.getLayer(id)) return;
      instance.addLayer(
        {
          id,
          type: 'raster',
          source: id,
          paint: { 'raster-fade-duration': 0, 'raster-resampling': 'linear' },
        },
        getShakingBeforeId(instance),
      );
    });
    return () => {
      stopPlacing();
      if (!instance.style?._loaded) return;
      if (instance.getLayer(id)) instance.removeLayer(id);
      if (instance.getSource(id)) instance.removeSource(id);
    };
  }, [map, id, canvas, corners]);

  useEffect(() => {
    paintPulseFrame(frame.data, raster, seconds, settled);
    canvas.getContext('2d')?.putImageData(frame, 0, 0);
    const source = map?.getSource<CanvasSource>(id);
    if (!source?.play) return;
    source.play();
    source.pause();
  }, [map, id, canvas, frame, raster, seconds, settled]);

  return null;
}
