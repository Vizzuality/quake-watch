import type { ExpressionSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import {
  getShakingBeforeId,
  placeOnStyle,
} from '@/containers/earthquake-detail/shared/shaking/map-layers';
import { syncPassedSegments } from '@/lib/shakemap/contour-state';
import type { ContourSegment } from '@/lib/shakemap/contours';
import { getArrivedCount } from '@/lib/shakemap/wave';

const SOURCE_ID = 'shakemap-contours';
const HALO_LAYER_ID = 'shakemap-contours-halo';
const LINE_LAYER_ID = 'shakemap-contours-line';
const HALO_COLOR = 'rgba(11, 13, 16, 0.4)';
const PASSED_OPACITY: ExpressionSpecification = [
  'case',
  ['boolean', ['feature-state', 'passed'], false],
  1,
  0,
];

function getContourGeoJson(segments: readonly ContourSegment[]) {
  return {
    type: 'FeatureCollection' as const,
    features: segments.map(({ coordinates, color }, index) => ({
      type: 'Feature' as const,
      id: index,
      properties: { color },
      geometry: { type: 'LineString' as const, coordinates: coordinates.map(([x, y]) => [x, y]) },
    })),
  };
}

export function ShakemapContours({
  segments,
  seconds,
  settled,
}: {
  segments: readonly ContourSegment[];
  seconds: number;
  settled: boolean;
}) {
  const { current: map } = useMap();
  const data = useMemo(() => getContourGeoJson(segments), [segments]);
  const arrivals = useMemo(() => Float64Array.from(segments, ({ arrival }) => arrival), [segments]);
  const passedCount = useRef(0);
  const targetCount = useRef(0);
  const passed = settled ? segments.length : getArrivedCount(arrivals, seconds);

  useEffect(() => {
    if (!map) return;
    const instance = map.getMap();
    const stopPlacing = placeOnStyle(instance, () => {
      if (instance.getSource(SOURCE_ID)) return;
      instance.addSource(SOURCE_ID, { type: 'geojson', data });
      const beforeId = getShakingBeforeId(instance);
      instance.addLayer(
        {
          id: HALO_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': HALO_COLOR, 'line-width': 4, 'line-opacity': PASSED_OPACITY },
        },
        beforeId,
      );
      instance.addLayer(
        {
          id: LINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': PASSED_OPACITY,
          },
        },
        beforeId,
      );
      syncPassedSegments(instance, SOURCE_ID, 0, targetCount.current);
      passedCount.current = targetCount.current;
    });
    return () => {
      stopPlacing();
      if (!instance.style?._loaded) return;
      for (const id of [LINE_LAYER_ID, HALO_LAYER_ID]) {
        if (instance.getLayer(id)) instance.removeLayer(id);
      }
      if (instance.getSource(SOURCE_ID)) instance.removeSource(SOURCE_ID);
    };
  }, [map, data]);

  useEffect(() => {
    targetCount.current = passed;
    const instance = map?.getMap();
    if (!instance?.getSource(SOURCE_ID)) return;
    syncPassedSegments(instance, SOURCE_ID, passedCount.current, passed);
    passedCount.current = passed;
  });

  return null;
}
