import { Point } from 'maplibre-gl';
import type { Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';
import { createRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Map as MapGL } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/components/map/maplibre-worker';
import { CORE_LAYER_ID } from '@/components/map/layers';
import { getDistanceKm } from '@/lib/earthquakes/distance';
import type { PlaybackClock } from '@/lib/map/playback-clock';
import { getRingHits } from '@/lib/map/ring-hits';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { EarthquakesLayer } from './earthquakes-layer';
import { EpicenterTooltip } from './epicenter-tooltip';
import { PlaybackProvider, usePlaybackClock } from './playback-context';
import { RingTooltip } from './ring-tooltip';

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

let probedClock: PlaybackClock | null = null;

function ClockProbe() {
  const clock = usePlaybackClock();
  useEffect(() => {
    probedClock = clock;
  }, [clock]);
  return null;
}

function stubHover(canHover: boolean) {
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
    query === '(hover: hover)'
      ? ({
          matches: canHover,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        } as unknown as MediaQueryList)
      : matchMedia(query),
  );
}

function moveMap(map: MaplibreMap, point: Point) {
  flushSync(() => map.fire('mousemove', { point, lngLat: map.unproject(point) }));
}

function showRingAt(map: MaplibreMap, point: Point) {
  const tMs = getRingTimeAt(map, point);
  flushSync(() => {
    probedClock!.setRange({ start: QUAKE_TIME - 60_000, end: QUAKE_TIME + 60_000 });
    probedClock!.setT(tMs);
  });
}

function clickMap(map: MaplibreMap, point: Point) {
  flushSync(() => map.fire('click', { point, lngLat: map.unproject(point) }));
}

const QUAKE_TIME = Date.parse('2026-08-14T23:04:40.18Z');
const RING_QUAKE = {
  id: 'e1',
  source: 'emsc' as const,
  magnitude: 3.5,
  magnitudeType: 'mb',
  place: null,
  time: QUAKE_TIME,
  depthKm: 2.1,
  latitude: EPICENTER.lat,
  longitude: EPICENTER.lng,
  url: '',
};

function getRingTimeAt(map: MaplibreMap, point: Point): number {
  const cursor = map.unproject(point);
  const next = map.unproject([point.x + 1, point.y]);
  const kmPerPx = getDistanceKm(
    { latitude: cursor.lat, longitude: cursor.lng },
    { latitude: next.lat, longitude: next.lng },
  );
  const range = { start: QUAKE_TIME - 60_000, end: QUAKE_TIME + 60_000 };
  for (let tMs = QUAKE_TIME; tMs <= range.end; tMs += 50) {
    const hits = getRingHits({
      earthquakes: [RING_QUAKE as never],
      tMs,
      waveSpanMs: (2_000 * (range.end - range.start)) / 30_000,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      cursor: { latitude: cursor.lat, longitude: cursor.lng },
      kmPerPx,
      tolerancePx: 2,
    });
    if (hits.length > 0) return tMs;
  }
  throw new Error('no ring passes the near-miss point');
}

async function renderPinnableMap(mag?: number, { width = 400, zoom = 8 } = {}) {
  stubFetch([
    {
      match: (url) => url.hostname === 'www.seismicportal.eu',
      respond: () => Response.json(getFeatureCollection([getEmscFeature({ id: 'e1', mag })])),
    },
  ]);
  const mapRef = createRef<MapRef>();
  const rendered = await renderWithRouter(
    () => (
      <PlaybackProvider>
        <ShowEverything />
        <div style={{ position: 'relative', width, height: 400 }}>
          <MapGL
            ref={mapRef}
            mapStyle={OFFLINE_STYLE}
            initialViewState={{ longitude: EPICENTER.lng, latitude: EPICENTER.lat, zoom }}
          >
            <EarthquakesLayer />
            <EpicenterTooltip />
            <RingTooltip />
          </MapGL>
          <ClockProbe />
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EpicenterTooltip pinning', () => {
  beforeEach(() => {
    stubHover(true);
  });

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

  it('pins a small dot on a near-miss click without a ring tooltip over it', async () => {
    const { screen, map, getEpicenterPoint } = await renderPinnableMap(RING_QUAKE.magnitude);
    const { x, y } = getEpicenterPoint();
    const nearMiss = new Point(x + 10, y);
    expect(map().queryRenderedFeatures(nearMiss, { layers: [CORE_LAYER_ID] })).toHaveLength(0);

    const tMs = getRingTimeAt(map(), nearMiss);
    flushSync(() => {
      probedClock!.setRange({ start: QUAKE_TIME - 60_000, end: QUAKE_TIME + 60_000 });
      probedClock!.setT(tMs);
    });
    flushSync(() =>
      map().fire('mousemove', { point: nearMiss, lngLat: map().unproject(nearMiss) }),
    );
    await expect.element(screen.getByText(/At this point/)).toBeVisible();

    clickMap(map(), nearMiss);
    await expect
      .element(screen.getByRole('link', { name: 'View details' }))
      .toHaveAttribute('href', '/earthquakes/emsc/e1');
    await expect.element(screen.getByText(/At this point/)).not.toBeInTheDocument();
  });

  it('shows the hover tooltip over a dot on a hover-capable pointer', async () => {
    const { screen, map, getEpicenterPoint } = await renderPinnableMap();
    moveMap(map(), getEpicenterPoint());
    await expect.element(screen.getByText(/spain/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'View details' }).elements()).toHaveLength(0);
  });
});

describe('Map tooltips on a pointer that cannot hover', () => {
  beforeEach(() => {
    stubHover(false);
  });

  it('ignores mousemove over a dot and pins it on the first tap', async () => {
    const { screen, map, getEpicenterPoint } = await renderPinnableMap();
    moveMap(map(), getEpicenterPoint());
    await expect.element(screen.getByText(/spain/i)).not.toBeInTheDocument();

    clickMap(map(), getEpicenterPoint());
    await expect
      .element(screen.getByRole('link', { name: 'View details' }))
      .toHaveAttribute('href', '/earthquakes/emsc/e1');
  });

  it('ignores mousemove over a ring and shows its info on a tap away from any dot', async () => {
    const { screen, map, getEpicenterPoint } = await renderPinnableMap(RING_QUAKE.magnitude);
    const { x, y } = getEpicenterPoint();
    const onRing = new Point(x + 30, y);
    showRingAt(map(), onRing);

    moveMap(map(), onRing);
    await expect.element(screen.getByText(/At this point/)).not.toBeInTheDocument();

    clickMap(map(), onRing);
    await expect.element(screen.getByText(/At this point/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'View details' }).elements()).toHaveLength(0);
  });
});

describe('EpicenterTooltip on repeated world copies', () => {
  beforeEach(() => {
    stubHover(true);
  });

  it('anchors the pinned tooltip on the world copy that was clicked', async () => {
    const { screen, map } = await renderPinnableMap(undefined, { width: 1400, zoom: 0 });
    const canonical = map().project([EPICENTER.lng, EPICENTER.lat]);
    const copy = map().project([EPICENTER.lng + 360, EPICENTER.lat]);
    expect(copy.x).toBeLessThan(1400);
    await expect
      .poll(() => map().queryRenderedFeatures(copy, { layers: [CORE_LAYER_ID] }).length)
      .toBeGreaterThan(0);

    clickMap(map(), copy);
    await expect.element(screen.getByRole('link', { name: 'View details' })).toBeVisible();
    const getPopupX = () => {
      const popup = map().getContainer().querySelector<HTMLElement>('.maplibregl-popup');
      const [, x] = /translate\(([-\d.]+)px/.exec(popup?.style.transform ?? '') ?? [];
      return Number(x);
    };
    await expect.poll(() => Math.abs(getPopupX() - copy.x)).toBeLessThan(50);
    expect(Math.abs(getPopupX() - canonical.x)).toBeGreaterThan(400);
  });
});
