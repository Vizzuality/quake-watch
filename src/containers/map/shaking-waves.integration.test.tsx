import type { StyleSpecification } from 'maplibre-gl';
import { createRef } from 'react';
import type { RefObject } from 'react';
import { Map as MapGL } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { describe, expect, it } from 'vitest';

import '@/components/map/maplibre-worker';
import { HALO_LAYER, SEARCH_AREA_LINE_LAYER } from '@/components/map/layers';
import { getFeatureCollection } from '@/test/fixtures/earthquakes';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { EarthquakesLayer } from './earthquakes-layer';
import { PlaybackProvider } from './playback-context';
import { SearchAreaLayer } from './search-area-layer';
import { ShakingWaves } from './shaking-waves';

const WAVES_LAYER_ID = 'shaking-waves';

const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b0d10' } }],
};

function getLayerIndexes(mapRef: RefObject<MapRef | null>) {
  const order = mapRef.current?.getMap().getLayersOrder() ?? [];
  return {
    waves: order.indexOf(WAVES_LAYER_ID),
    halo: order.indexOf(HALO_LAYER.id),
    searchArea: order.indexOf(SEARCH_AREA_LINE_LAYER.id),
  };
}

describe('ShakingWaves layer order', () => {
  it('keeps the waves directly below the halo and above a search area mounted later', async () => {
    stubFetch([
      {
        match: (url) => url.hostname === 'www.seismicportal.eu',
        respond: () => Response.json(getFeatureCollection([])),
      },
    ]);
    const mapRef = createRef<MapRef>();
    const { router } = await renderWithRouter(() => (
      <PlaybackProvider>
        <div style={{ position: 'relative', width: 400, height: 300 }}>
          <MapGL
            ref={mapRef}
            mapStyle={OFFLINE_STYLE}
            initialViewState={{ longitude: 0, latitude: 0, zoom: 1 }}
          >
            <EarthquakesLayer />
            <SearchAreaLayer />
            <ShakingWaves />
          </MapGL>
        </div>
      </PlaybackProvider>
    ));

    await expect.poll(() => getLayerIndexes(mapRef).waves).toBeGreaterThan(0);
    const before = getLayerIndexes(mapRef);
    expect(before.waves).toBe(before.halo - 1);
    expect(before.searchArea).toBe(-1);

    await router.navigate({ to: '/', search: { lat: 37.18, lon: -3.6 } });

    await expect.poll(() => getLayerIndexes(mapRef).searchArea).toBeGreaterThan(-1);
    await expect
      .poll(() => {
        const { waves, halo } = getLayerIndexes(mapRef);
        return waves === halo - 1;
      })
      .toBe(true);
    const after = getLayerIndexes(mapRef);
    expect(after.searchArea).toBeLessThan(after.waves);
  });
});
