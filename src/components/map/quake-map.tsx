import 'maplibre-gl/dist/maplibre-gl.css';
import type { ReactNode } from 'react';
import { AttributionControl, Map as MapGL } from 'react-map-gl/maplibre';

import './maplibre-worker';
import { MAP_STYLE_URL } from './basemap';

const INITIAL_VIEW_STATE = { longitude: 0, latitude: 20, zoom: 1.4 };

export function QuakeMap({ attribution, children }: { attribution: string; children: ReactNode }) {
  return (
    <MapGL
      initialViewState={INITIAL_VIEW_STATE}
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
