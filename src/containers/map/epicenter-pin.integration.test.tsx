import { Point } from 'maplibre-gl';
import type { Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';
import { createRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Map as MapGL } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { describe, expect, it } from 'vitest';

import '@/components/map/maplibre-worker';
import { CORE_LAYER_ID } from '@/components/map/layers';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { EarthquakesLayer } from './earthquakes-layer';
import { EpicenterTooltip } from './epicenter-tooltip';
import { PlaybackProvider, usePlaybackClock } from './playback-context';

const EPICENTER = { lng: -3.6316, lat: 37.1147 };

const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b0d10' } }],
};

function ShowEverything() {
  const clock = usePlaybackClock();
  useEffect(() => {
    clock.setRange({ start: 0, end: Date.now() });
    clock.setT(Date.now());
  }, [clock]);
  return null;
}

function clickMap(map: MaplibreMap, point: Point) {
  flushSync(() => map.fire('click', { point, lngLat: map.unproject(point) }));
}

async function renderPinnableMap() {
  stubFetch([
    {
      match: (url) => url.hostname === 'www.seismicportal.eu',
      respond: () => Response.json(getFeatureCollection([getEmscFeature({ id: 'e1' })])),
    },
  ]);
  const mapRef = createRef<MapRef>();
  const rendered = await renderWithRouter(
    () => (
      <PlaybackProvider>
        <ShowEverything />
        <div style={{ position: 'relative', width: 400, height: 300 }}>
          <MapGL
            ref={mapRef}
            mapStyle={OFFLINE_STYLE}
            initialViewState={{ longitude: EPICENTER.lng, latitude: EPICENTER.lat, zoom: 8 }}
          >
            <EarthquakesLayer />
            <EpicenterTooltip />
          </MapGL>
        </div>
      </PlaybackProvider>
    ),
    '/?period=1y',
  );
  const map = () => mapRef.current!.getMap();
  const getEpicenterPoint = () => map().project([EPICENTER.lng, EPICENTER.lat]);
  await expect
    .poll(
      () => map().queryRenderedFeatures(getEpicenterPoint(), { layers: [CORE_LAYER_ID] }).length,
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0);
  return { ...rendered, map, getEpicenterPoint };
}

describe('EpicenterTooltip pinning', () => {
  it('pins on click and offers a link to the detail page', async () => {
    const { screen, map, getEpicenterPoint, router } = await renderPinnableMap();
    expect(screen.getByRole('link', { name: 'View details' }).elements()).toHaveLength(0);

    clickMap(map(), getEpicenterPoint());
    const link = screen.getByRole('link', { name: 'View details' });
    await expect.element(link).toHaveAttribute('href', '/earthquakes/emsc/e1');

    await link.click();
    await expect.poll(() => router.state.location.pathname).toBe('/earthquakes/emsc/e1');
  });

  it('keeps the tooltip pinned when the pointer moves to empty map', async () => {
    const { screen, map, getEpicenterPoint } = await renderPinnableMap();
    clickMap(map(), getEpicenterPoint());
    await expect.element(screen.getByRole('link', { name: 'View details' })).toBeVisible();

    map().fire('mousemove', { point: new Point(1, 1), lngLat: map().unproject([1, 1]) });
    map()
      .getCanvas()
      .dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    await expect.element(screen.getByRole('link', { name: 'View details' })).toBeVisible();
  });

  it('closes on a click on empty map', async () => {
    const { screen, map, getEpicenterPoint } = await renderPinnableMap();
    clickMap(map(), getEpicenterPoint());
    await expect.element(screen.getByRole('link', { name: 'View details' })).toBeVisible();

    clickMap(map(), new Point(1, 1));
    await expect
      .element(screen.getByRole('link', { name: 'View details' }))
      .not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const { screen, map, getEpicenterPoint } = await renderPinnableMap();
    clickMap(map(), getEpicenterPoint());
    await expect.element(screen.getByRole('link', { name: 'View details' })).toBeVisible();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect
      .element(screen.getByRole('link', { name: 'View details' }))
      .not.toBeInTheDocument();
  });
});
