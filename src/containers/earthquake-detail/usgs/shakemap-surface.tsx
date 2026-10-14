import type { CanvasSource, Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { type CanvasSize, getRevealOutline, getShakemapCorners } from '@/lib/shakemap/canvas';
import type { ShakemapContour } from '@/lib/shakemap/contours';
import type { ShakemapGrid } from '@/lib/shakemap/coverage';
import type { ShakemapReveal } from '@/lib/shakemap/readout';

import { drawReveal, getCanvas, getShakemapArtwork } from './shakemap-artwork';

const SURFACE_ID = 'shakemap-surface';
const SURFACE_OPACITY = 0.8;
const BOUNDARY_LAYER_PREFIX = 'boundary';

function getClipOutline(grid: ShakemapGrid, size: CanvasSize, reveal: ShakemapReveal) {
  return reveal.complete ? null : getRevealOutline(grid, size, reveal.epicenter, reveal.radiusKm);
}

function getSurfaceBeforeId(map: MapLibreMap): string | undefined {
  const order = map.getLayersOrder();
  return (
    order.find((id) => id.startsWith(BOUNDARY_LAYER_PREFIX)) ??
    order.find((id) => map.getLayer(id)?.type === 'symbol')
  );
}

export function ShakemapSurface({
  grid,
  contours,
  reveal,
}: {
  grid: ShakemapGrid;
  contours: readonly ShakemapContour[];
  reveal: ShakemapReveal;
}) {
  const { current: map } = useMap();
  const { epicenter } = reveal;
  const artwork = useMemo(() => getShakemapArtwork(grid, contours), [grid, contours]);
  const canvas = useMemo(() => getCanvas(artwork), [artwork]);
  const epicenterGeoJson = useMemo(
    () => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [epicenter.longitude, epicenter.latitude] },
      properties: {},
    }),
    [epicenter.latitude, epicenter.longitude],
  );

  useEffect(() => {
    if (!map) return;
    const instance = map.getMap();
    const coordinates = getShakemapCorners(grid);

    const placeSurface = () => {
      if (!instance.style?._loaded) return;
      if (!instance.getSource(SURFACE_ID)) {
        instance.addSource(SURFACE_ID, { type: 'canvas', canvas, coordinates, animate: false });
      }
      if (!instance.getLayer(SURFACE_ID)) {
        instance.addLayer(
          {
            id: SURFACE_ID,
            type: 'raster',
            source: SURFACE_ID,
            paint: {
              'raster-opacity': SURFACE_OPACITY,
              'raster-fade-duration': 0,
              'raster-resampling': 'linear',
            },
          },
          getSurfaceBeforeId(instance),
        );
      }
    };

    placeSurface();
    instance.on('styledata', placeSurface);
    return () => {
      instance.off('styledata', placeSurface);
      if (!instance.style?._loaded) return;
      if (instance.getLayer(SURFACE_ID)) instance.removeLayer(SURFACE_ID);
      if (instance.getSource(SURFACE_ID)) instance.removeSource(SURFACE_ID);
    };
  }, [map, canvas, grid]);

  useEffect(() => {
    drawReveal(canvas, artwork, getClipOutline(grid, canvas, reveal));
    const source = map?.getSource<CanvasSource>(SURFACE_ID);
    if (!source?.play) return;
    source.play();
    source.pause();
  }, [map, canvas, artwork, grid, reveal]);

  return (
    <Source id="shakemap-epicenter" type="geojson" data={epicenterGeoJson}>
      <Layer
        id="shakemap-epicenter"
        type="circle"
        paint={{
          'circle-radius': 5,
          'circle-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0b0d10',
        }}
      />
    </Source>
  );
}
