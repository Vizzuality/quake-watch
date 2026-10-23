import type { ExpressionSpecification } from 'maplibre-gl';
import { Layer, Source } from 'react-map-gl/maplibre';

import {
  BUBBLE_CLUSTER_PROPERTIES,
  type BubbleCollection,
  SETTLED_BUBBLE_OPACITY,
  getBubbleTextColorExpression,
  getSettledBubbleColorExpression,
  getSettledBubbleRadiusExpression,
} from '@/lib/felt-reports/bubbles';
import { FELT_REPORTS_PALETTE } from '@/lib/felt-reports/palette';
import type { Locale } from '@/paraglide/runtime';

export const BUBBLE_LAYER_ID = 'felt-bubbles';
const SOURCE_ID = 'felt-bubbles';
const COUNT_LAYER_ID = 'felt-bubble-counts';
const CLUSTER_RADIUS_PX = 40;
const CLUSTER_MAX_ZOOM = 9;
const COUNT_FONT = ['Noto Sans Bold'];
const STROKE_COLOR = '#0b0d10';

const CIRCLE_PAINT = {
  'circle-radius': getSettledBubbleRadiusExpression(),
  'circle-color': getSettledBubbleColorExpression(FELT_REPORTS_PALETTE),
  'circle-opacity': SETTLED_BUBBLE_OPACITY,
  'circle-stroke-width': 1,
  'circle-stroke-color': STROKE_COLOR,
  'circle-stroke-opacity': 0.6,
};
const COUNT_PAINT = {
  'text-color': getBubbleTextColorExpression(),
  'text-opacity': 1,
};

function getCountField(locale: Locale): ExpressionSpecification {
  return ['number-format', ['get', 'reports'], { locale }];
}

export function FeltReportBubbles({ data, locale }: { data: BubbleCollection; locale: Locale }) {
  return (
    <Source
      id={SOURCE_ID}
      type="geojson"
      data={data}
      cluster
      clusterRadius={CLUSTER_RADIUS_PX}
      clusterMaxZoom={CLUSTER_MAX_ZOOM}
      clusterProperties={BUBBLE_CLUSTER_PROPERTIES}
    >
      <Layer id={BUBBLE_LAYER_ID} type="circle" paint={CIRCLE_PAINT} />
      <Layer
        id={COUNT_LAYER_ID}
        type="symbol"
        layout={{
          'text-field': getCountField(locale),
          'text-font': COUNT_FONT,
          'text-size': 11,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        }}
        paint={COUNT_PAINT}
      />
    </Source>
  );
}
