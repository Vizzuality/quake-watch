import 'maplibre-gl/dist/maplibre-gl.css';
import { useMemo } from 'react';
import { AttributionControl, Layer, Map as MapGL, Source } from 'react-map-gl/maplibre';

import { getEarthquakesGeoJson } from '@/earthquakes/magnitude';
import type { Earthquake } from '@/earthquakes/types';

import './maplibre-worker';
import { MAP_STYLE_URL } from './basemap';
import { CORE_LAYER, HALO_LAYER, QUAKE_SOURCE_ID } from './layers';

const INITIAL_VIEW_STATE = { longitude: 0, latitude: 20, zoom: 1.4 };

export function QuakeMap({ earthquakes }: { earthquakes: Earthquake[] }) {
  const geojson = useMemo(() => getEarthquakesGeoJson(earthquakes), [earthquakes]);

  return (
    <MapGL
      initialViewState={INITIAL_VIEW_STATE}
      mapStyle={MAP_STYLE_URL}
      dragRotate={false}
      touchPitch={false}
      attributionControl={false}
      style={{ position: 'absolute', inset: 0 }}
    >
      <AttributionControl compact customAttribution="Earthquake data: USGS" />
      <Source id={QUAKE_SOURCE_ID} type="geojson" data={geojson}>
        <Layer {...HALO_LAYER} />
        <Layer {...CORE_LAYER} />
      </Source>
    </MapGL>
  );
}
