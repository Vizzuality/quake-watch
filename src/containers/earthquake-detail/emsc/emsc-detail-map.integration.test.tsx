import type { Map as MapLibreMap } from 'maplibre-gl';
import { useEffect } from 'react';
import { MapProvider, useMap } from 'react-map-gl/maplibre';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEmscDetailFeature } from '@/test/fixtures/emsc-detail';
import { getFeltReportsCsv, getFeltReportsZip } from '@/test/fixtures/felt-reports-zip';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { EmscDetailMap } from './emsc-detail-map';

const ID = '20261009_0000264';
const BASEMAP_STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background' }],
};
const EPICENTER = { longitude: 152.1142, latitude: -5.4162 };
const BUBBLE_SOURCE = 'felt-bubbles';
const BUBBLE_LAYER = 'felt-bubbles';
const SETTLED_OPACITY = 0.85;
const UNFELT_DEPTH_KM = 300;
const REPORTS_COPY =
  /^Recreated: the rings\. .* reach the farthest place where someone reported feeling it\.$/;
const ESTIMATE_COPY = /^Recreated: the rings\. .* from magnitude and depth only\.$/;
const mapRef: { current: MapLibreMap | undefined } = { current: undefined };

function getRows(longitude: number, latitude: number, intensity: number, count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) =>
      `${longitude + index * 1e-5},${latitude},2026-10-09T01:02:03Z,app,${intensity},${intensity}`,
  );
}

const CSV_ROWS = [
  ...getRows(EPICENTER.longitude, EPICENTER.latitude, 4, 23),
  ...getRows(EPICENTER.longitude - 0.3, EPICENTER.latitude - 0.2, 5, 5),
];

function MapProbe() {
  const { default: sceneMap } = useMap();
  useEffect(() => {
    mapRef.current = sceneMap?.getMap();
  }, [sceneMap]);
  return null;
}

function stubEmsc(reports: () => Response | Promise<Response>, depth?: number) {
  return stubFetch([
    { match: (url) => url.pathname.includes('testimonies-ws'), respond: reports },
    {
      match: (url) => url.hostname === 'www.seismicportal.eu' && url.searchParams.has('eventid'),
      respond: () => Response.json(getEmscDetailFeature({ id: ID, depth })),
    },
    {
      match: (url) =>
        url.hostname === 'tiles.openfreemap.org' && url.pathname.startsWith('/fonts/'),
      respond: () => new Response(new ArrayBuffer(0)),
    },
    {
      match: (url) => url.hostname === 'tiles.openfreemap.org',
      respond: () => Response.json(BASEMAP_STYLE),
    },
    { match: () => true, respond: () => new Response(null, { status: 404 }) },
  ]);
}

async function getReportsResponse(rows: string[]): Promise<Response> {
  return new Response(await getFeltReportsZip({ [`${ID}.csv`]: getFeltReportsCsv(rows) }));
}

async function renderMap() {
  const { screen } = await renderWithRouter(() => (
    <MapProvider>
      <EmscDetailMap earthquakeId={ID} />
      <MapProbe />
    </MapProvider>
  ));
  return screen;
}

function getBubbleFeatureCount(): number {
  const map = mapRef.current;
  if (!map?.getSource(BUBBLE_SOURCE) || !map.isSourceLoaded(BUBBLE_SOURCE)) return 0;
  return map.querySourceFeatures(BUBBLE_SOURCE).length;
}

function getTrainFeatureCount(): number {
  const map = mapRef.current;
  if (!map?.getSource('wave-train') || !map.isSourceLoaded('wave-train')) return 0;
  return map.querySourceFeatures('wave-train').length;
}

describe('EmscDetailMap', () => {
  beforeEach(() => {
    mapRef.current = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders one map with fully opaque bubbles and a running train', async () => {
    stubEmsc(() => getReportsResponse(CSV_ROWS));
    const screen = await renderMap();

    await expect.poll(getBubbleFeatureCount, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(screen.getByRole('figure').elements()).toHaveLength(1);
    const map = mapRef.current as MapLibreMap;
    expect(map.getPaintProperty(BUBBLE_LAYER, 'circle-opacity')).toBe(SETTLED_OPACITY);
    expect(map.getPaintProperty(BUBBLE_LAYER, 'circle-stroke-opacity')).toBe(0.6);
    await expect.poll(getTrainFeatureCount, { timeout: 10_000 }).toBeGreaterThan(0);
  });

  it('lists the felt scale and the real and recreated copy in the legend', async () => {
    stubEmsc(() => getReportsResponse(CSV_ROWS));
    const screen = await renderMap();

    const button = screen.getByRole('button', { name: 'Legend' });
    await expect.element(button).toBeVisible();
    await button.click();
    await expect.element(screen.getByText('Reported Intensity (Modified Mercalli)')).toBeVisible();
    await expect.element(screen.getByText('Number of reports')).toBeVisible();
    await expect.element(screen.getByText(/^Real: each bubble groups felt reports/)).toBeVisible();
    await expect.element(screen.getByText(REPORTS_COPY)).toBeVisible();
    expect(screen.getByText(ESTIMATE_COPY).elements()).toHaveLength(0);
    await expect
      .element(screen.getByRole('link', { name: 'EMSC testimonies service (CC BY 4.0)' }))
      .toBeVisible();
  });

  it('shows the train without bubbles when there are no felt reports', async () => {
    stubEmsc(() => new Response(null, { status: 204 }));
    const screen = await renderMap();

    await expect.poll(getTrainFeatureCount, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(mapRef.current?.getLayer(BUBBLE_LAYER)).toBeUndefined();
    await screen.getByRole('button', { name: 'Legend' }).click();
    await expect.element(screen.getByText(ESTIMATE_COPY)).toBeVisible();
    expect(screen.getByText(REPORTS_COPY).elements()).toHaveLength(0);
    expect(screen.getByText('Reported Intensity (Modified Mercalli)').elements()).toHaveLength(0);
  });

  it('runs the train out to the farthest report when the estimate reaches nowhere', async () => {
    stubEmsc(() => getReportsResponse(CSV_ROWS), UNFELT_DEPTH_KM);
    const screen = await renderMap();

    await expect.poll(getTrainFeatureCount, { timeout: 10_000 }).toBeGreaterThan(0);
    await screen.getByRole('button', { name: 'Legend' }).click();
    await expect.element(screen.getByText(REPORTS_COPY)).toBeVisible();
  });

  it('keeps the train when the felt reports fail to load', async () => {
    stubEmsc(() => new Response(null, { status: 500 }));
    await renderMap();

    await expect.poll(getTrainFeatureCount, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(mapRef.current?.getLayer(BUBBLE_LAYER)).toBeUndefined();
  });
});
