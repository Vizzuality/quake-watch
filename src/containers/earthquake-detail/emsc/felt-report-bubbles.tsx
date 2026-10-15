import type { ExpressionSpecification } from 'maplibre-gl';
import { useEffect } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { placeOnStyle } from '@/containers/earthquake-detail/shared/shaking/map-layers';
import {
  BUBBLE_CLUSTER_PROPERTIES,
  BUBBLE_SECONDS_STATE,
  type BubbleCollection,
  getBubbleArrivedExpression,
  getBubbleColorExpression,
  getBubbleOpacityExpression,
  getBubbleRadiusExpression,
  getBubbleSeconds,
  getBubbleTextColorExpression,
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
  'circle-radius': getBubbleRadiusExpression(),
  'circle-color': getBubbleColorExpression(FELT_REPORTS_PALETTE),
  'circle-opacity': getBubbleOpacityExpression(),
  'circle-stroke-width': 1,
  'circle-stroke-color': STROKE_COLOR,
  'circle-stroke-opacity': getBubbleArrivedExpression(0.6),
};
const COUNT_PAINT = {
  'text-color': getBubbleTextColorExpression(),
  'text-opacity': getBubbleArrivedExpression(1),
};

function getCountField(locale: Locale): ExpressionSpecification {
  return ['number-format', ['get', 'reports'], { locale }];
}

export function FeltReportBubbles({
  data,
  seconds,
  complete,
  locale,
}: {
  data: BubbleCollection;
  seconds: number;
  complete: boolean;
  locale: Locale;
}) {
  const { current: map } = useMap();
  const bubbleSeconds = getBubbleSeconds(seconds, complete);

  useEffect(() => {
    if (!map) return;
    const instance = map.getMap();
    return placeOnStyle(instance, () =>
      instance.setGlobalStateProperty(BUBBLE_SECONDS_STATE, bubbleSeconds),
    );
  }, [map, bubbleSeconds]);

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
