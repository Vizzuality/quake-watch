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

export const HALO_LAYER: Omit<CircleLayerSpecification, 'source'> = {
  id: 'earthquakes-halo',
  type: 'circle',
  paint: {
    'circle-radius': ['*', 2.2, getMagnitudeRadiusExpression()],
    'circle-color': getMagnitudeColorExpression(),
    'circle-blur': 1,
    'circle-opacity': ['*', 0.35, getAgeOpacityExpression()],
  },
};

export const CORE_LAYER: Omit<CircleLayerSpecification, 'source'> = {
  id: 'earthquakes-core',
  type: 'circle',
  paint: {
    'circle-radius': getMagnitudeRadiusExpression(),
    'circle-color': getMagnitudeColorExpression(),
    'circle-opacity': ['*', 0.9, getAgeOpacityExpression()],
    'circle-stroke-width': 1,
    'circle-stroke-color': 'rgba(255, 255, 255, 0.35)',
    'circle-stroke-opacity': getAgeOpacityExpression(),
  },
};

export const SEARCH_AREA_SOURCE_ID = 'search-area';

export const SEARCH_AREA_LINE_LAYER: Omit<LineLayerSpecification, 'source'> = {
  id: 'search-area-line',
  type: 'line',
  filter: ['==', ['get', 'kind'], 'area'],
  paint: {
    'line-color': '#f4f1ea',
    'line-opacity': 0.6,
    'line-width': 1.5,
    'line-dasharray': [2, 2],
  },
};

export const PLACE_OF_INTEREST_LAYER: Omit<CircleLayerSpecification, 'source'> = {
  id: 'place-of-interest',
  type: 'circle',
  filter: ['==', ['get', 'kind'], 'place'],
  paint: {
    'circle-radius': 5,
    'circle-color': '#f4f1ea',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#0b0d10',
  },
};
