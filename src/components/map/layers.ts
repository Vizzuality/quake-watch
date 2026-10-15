import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  LineLayerSpecification,
} from 'maplibre-gl';

import {
  getMagnitudeColorExpression,
  getMagnitudeRadiusExpression,
} from '@/lib/earthquakes/magnitude';
import { AGE_OPACITY_FLOOR } from '@/lib/earthquakes/timeline';
import type { MapPalette } from '@/lib/theme/map-palette';

export const QUAKE_SOURCE_ID = 'earthquakes';

export function getAgeOpacityExpression(): ExpressionSpecification {
  const t: ExpressionSpecification = ['to-number', ['global-state', 't'], 0];
  const windowStart: ExpressionSpecification = ['to-number', ['global-state', 'windowStart'], 0];
  const windowMs: ExpressionSpecification = ['to-number', ['global-state', 'windowMs'], 1];
  const time: ExpressionSpecification = ['get', 'time'];

  return [
    'case',
    ['>', time, t],
    0,
    ['<', time, windowStart],
    0,
    ['interpolate', ['linear'], ['/', ['-', t, time], windowMs], 0, 1, 1, AGE_OPACITY_FLOOR],
  ];
}

export const HALO_LAYER_ID = 'earthquakes-halo';
export const CORE_LAYER_ID = 'earthquakes-core';

export function getHaloLayer(palette: MapPalette): Omit<CircleLayerSpecification, 'source'> {
  return {
    id: HALO_LAYER_ID,
    type: 'circle',
    paint: {
      'circle-radius': ['*', 2.2, getMagnitudeRadiusExpression()],
      'circle-color': getMagnitudeColorExpression(palette.magnitude),
      'circle-blur': 1,
      'circle-opacity': ['*', 0.35, getAgeOpacityExpression()],
    },
  };
}

export function getCoreLayer(palette: MapPalette): Omit<CircleLayerSpecification, 'source'> {
  return {
    id: CORE_LAYER_ID,
    type: 'circle',
    paint: {
      'circle-radius': getMagnitudeRadiusExpression(),
      'circle-color': getMagnitudeColorExpression(palette.magnitude),
      'circle-opacity': ['*', 0.9, getAgeOpacityExpression()],
      'circle-stroke-width': 1,
      'circle-stroke-color': palette.fg,
      'circle-stroke-opacity': ['*', 0.5, getAgeOpacityExpression()],
    },
  };
}

export const SEARCH_AREA_SOURCE_ID = 'search-area';
export const SEARCH_AREA_LINE_LAYER_ID = 'search-area-line';

export function getSearchAreaLineLayer(
  palette: MapPalette,
): Omit<LineLayerSpecification, 'source'> {
  return {
    id: SEARCH_AREA_LINE_LAYER_ID,
    type: 'line',
    filter: ['==', ['get', 'kind'], 'area'],
    paint: {
      'line-color': palette.fg,
      'line-opacity': 0.6,
      'line-width': 1.5,
      'line-dasharray': [2, 2],
    },
  };
}

export function getPlaceOfInterestLayer(
  palette: MapPalette,
): Omit<CircleLayerSpecification, 'source'> {
  return {
    id: 'place-of-interest',
    type: 'circle',
    filter: ['==', ['get', 'kind'], 'place'],
    paint: {
      'circle-radius': 5,
      'circle-color': palette.fg,
      'circle-stroke-width': 2,
      'circle-stroke-color': palette.canvas,
    },
  };
}
