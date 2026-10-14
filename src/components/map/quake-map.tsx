import 'maplibre-gl/dist/maplibre-gl.css';
import type { ReactNode } from 'react';
import { AttributionControl, Map as MapGL, type MapProps } from 'react-map-gl/maplibre';

import './maplibre-worker';
import { MAP_STYLE_URL } from './basemap';

const INITIAL_VIEW_STATE = { longitude: 0, latitude: 20, zoom: 1.4 };

type QuakeMapProps = Pick<
  MapProps,
  | 'initialViewState'
  | 'scrollZoom'
  | 'dragPan'
  | 'touchZoomRotate'
  | 'cursor'
  | 'onMouseMove'
  | 'onMouseOut'
  | 'onClick'
> & {
  attribution: string;
  children: ReactNode;
  interactive?: boolean;
};

export function QuakeMap({
  attribution,
  children,
  initialViewState = INITIAL_VIEW_STATE,
  interactive = true,
  ...mapProps
}: QuakeMapProps) {
  return (
    <MapGL
      {...mapProps}
      initialViewState={initialViewState}
      interactive={interactive}
      mapStyle={MAP_STYLE_URL}
      dragRotate={false}
      touchPitch={false}
      attributionControl={false}
      style={{ position: 'absolute', inset: 0 }}
    >
      <AttributionControl compact customAttribution={attribution} />
      {children}
    </MapGL>
  );
}
