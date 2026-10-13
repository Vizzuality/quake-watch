import type { CircleLayerSpecification } from 'maplibre-gl';

import {
  getMagnitudeColorExpression,
  getMagnitudeRadiusExpression,
} from '@/lib/earthquakes/magnitude';

export const QUAKE_SOURCE_ID = 'earthquakes';

export const HALO_LAYER: Omit<CircleLayerSpecification, 'source'> = {
  id: 'earthquakes-halo',
  type: 'circle',
  paint: {
    'circle-radius': ['*', 2.2, getMagnitudeRadiusExpression()],
    'circle-color': getMagnitudeColorExpression(),
    'circle-blur': 1,
    'circle-opacity': 0.35,
  },
};

export const CORE_LAYER: Omit<CircleLayerSpecification, 'source'> = {
  id: 'earthquakes-core',
  type: 'circle',
  paint: {
    'circle-radius': getMagnitudeRadiusExpression(),
    'circle-color': getMagnitudeColorExpression(),
    'circle-opacity': 0.9,
    'circle-stroke-width': 1,
    'circle-stroke-color': 'rgba(255, 255, 255, 0.35)',
  },
};
