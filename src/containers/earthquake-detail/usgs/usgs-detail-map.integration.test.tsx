import type { GeoJSONSource } from 'maplibre-gl';
import { useEffect } from 'react';
import { MapProvider, type MapRef, useMap } from 'react-map-gl/maplibre';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getIntensityShortLabel } from '@/containers/earthquake-detail/shared/shaking/shaking-labels';
import { getDecimalLabel } from '@/lib/format';
import { getShakemapContours } from '@/lib/shakemap/contours';
import { getWaveTrainShape } from '@/lib/shakemap/wave-train';
import { getLocale } from '@/paraglide/runtime';
import { usgsOriginOnlyDetail, usgsPanamaDetail } from '@/test/fixtures/usgs-detail';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { UsgsDetailMap } from './usgs-detail-map';

const SHAKEMAP_PATH = '/product/shakemap/';
const BASEMAP_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background' }],
};
const PANAMA_EPICENTER = { latitude: 7.5868, longitude: -80.769, magnitude: 7.7, depthKm: 12.647 };
const RING_VERTICES = 36;
const LEVELS = [
  { mmi: 6, color: '#ffff00', halfWidthDegrees: 0.3 },
  { mmi: 5.5, color: '#d0f219', halfWidthDegrees: 0.5 },
  { mmi: 5, color: '#a0e632', halfWidthDegrees: 0.7 },
  { mmi: 4, color: '#80ffff', halfWidthDegrees: 1.2 },
];
const mapRef: { current: MapRef | undefined } = { current: undefined };

function MapProbe() {
  const { default: current } = useMap();
  useEffect(() => {
    mapRef.current = current;
  }, [current]);
  return null;
}

function getRing(halfWidthDegrees: number): Array<[number, number]> {
  return Array.from({ length: RING_VERTICES + 1 }, (_, index) => {
    const angle = (index / RING_VERTICES) * 2 * Math.PI;
    return [
      PANAMA_EPICENTER.longitude + halfWidthDegrees * Math.cos(angle),
      PANAMA_EPICENTER.latitude + halfWidthDegrees * Math.sin(angle),
    ];
  });
}

const panamaContours = {
  type: 'FeatureCollection',
  features: LEVELS.map(({ mmi, color, halfWidthDegrees }) => ({
    type: 'Feature',
    properties: { value: mmi, units: 'mmi', color, weight: 4 },
    geometry: { type: 'LineString', coordinates: getRing(halfWidthDegrees) },
  })),
};

const CHANNEL_TOLERANCE = 1;

function getHexRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function getCssRgb(color: string): [number, number, number] {
  return (color.match(/\d+/g) ?? []).map(Number) as [number, number, number];
}

function isBetweenColors(
  color: readonly number[],
  from: readonly number[],
  to: readonly number[],
): boolean {
  const spans = from.map((channel, index) => to[index] - channel);
  const pivot = spans.reduce(
    (widest, span, index) => (Math.abs(span) > Math.abs(spans[widest]) ? index : widest),
    0,
  );
  const weight = spans[pivot] === 0 ? 0 : (color[pivot] - from[pivot]) / spans[pivot];
  if (weight < 0 || weight > 1) return false;
  return color.every(
    (channel, index) =>
      Math.abs(channel - (from[index] + spans[index] * weight)) <= CHANNEL_TOLERANCE,
  );
}

function isContourColor(color: string): boolean {
  const rgb = getCssRgb(color);
  const stops = LEVELS.map(({ color: hex }) => getHexRgb(hex));
  return stops.some((stop, index) => isBetweenColors(rgb, stop, stops[index + 1] ?? stop));
}

function stubUsgs(detail: unknown, contoursStatus = 200) {
  return stubFetch([
    { match: (url) => url.searchParams.has('eventid'), respond: () => Response.json(detail) },
    {
      match: (url) => url.hostname === 'tiles.openfreemap.org',
      respond: () => Response.json(BASEMAP_STYLE),
    },
    {
      match: (url) =>
        url.pathname.startsWith(SHAKEMAP_PATH) && url.pathname.endsWith('cont_mmi.json'),
      respond: () => Response.json(panamaContours, { status: contoursStatus }),
    },
    { match: () => true, respond: () => new Response(null, { status: 404 }) },
  ]);
}

function getRequestedUrls(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

async function getTrainFeatures(): Promise<Array<{ properties: { color: string | null } }>> {
  const source = mapRef.current?.getMap().getSource<GeoJSONSource>('wave-train');
  if (!source) return [];
  const data = (await source.getData()) as {
    features: Array<{ properties: { color: string | null } }>;
  };
  return data.features;
}

async function renderMap(id: string) {
  const { screen } = await renderWithRouter(
    () => (
      <MapProvider>
        <UsgsDetailMap earthquakeId={id} />
        <MapProbe />
      </MapProvider>
    ),
    `/earthquakes/usgs/${id}`,
  );
  return screen;
}

describe('UsgsDetailMap', () => {
  beforeEach(() => {
    mapRef.current = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('draws the isoseismal wave train on one map without requesting the coverage file', async () => {
    const fetchMock = stubUsgs(usgsPanamaDetail);
    const screen = await renderMap('us6000u18k');

    await expect
      .poll(async () => (await getTrainFeatures()).length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    expect(document.querySelectorAll('.maplibregl-map')).toHaveLength(1);
    const colors = (await getTrainFeatures())
      .map(({ properties }) => properties.color)
      .filter((color) => color !== null);
    expect(colors.length).toBeGreaterThan(0);
    expect(colors.filter((color) => !isContourColor(color))).toEqual([]);
    const requested = getRequestedUrls(fetchMock);
    expect(requested.some((url) => url.endsWith('cont_mmi.json'))).toBe(true);
    expect(requested.some((url) => url.includes('coverage'))).toBe(false);

    await screen.getByRole('button', { name: 'Legend' }).click();
    const legend = screen.getByRole('group', { name: 'Legend' });
    const profiles = getWaveTrainShape(getShakemapContours(panamaContours), PANAMA_EPICENTER);
    const levels = profiles.kind === 'isoseismal' ? profiles.profiles : [];
    expect(levels.length).toBeGreaterThan(0);
    expect(legend.getByRole('listitem').elements()).toHaveLength(levels.length);
    const texts = legend
      .getByRole('listitem')
      .elements()
      .map((item) => item.textContent?.trim());
    expect(new Set(texts).size).toBe(levels.length);
    for (const { mmi } of levels) {
      const label = `${getIntensityShortLabel(mmi, getLocale())} (${getDecimalLabel(mmi, getLocale(), 1)})`;
      await expect.element(legend.getByText(label, { exact: true })).toBeVisible();
    }
    expect(texts.some((text) => text?.endsWith('(5.5)'))).toBe(true);
    await expect.element(legend.getByText(/^Real: the shape and colour/)).toBeVisible();
  });

  it('falls back to rings and circle copy when the Earthquake has no ShakeMap', async () => {
    const fetchMock = stubUsgs(usgsOriginOnlyDetail);
    const screen = await renderMap('us6000u23d');

    await expect
      .poll(async () => (await getTrainFeatures()).length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    expect(document.querySelectorAll('.maplibregl-map')).toHaveLength(1);
    const features = await getTrainFeatures();
    expect(features.every((feature) => feature.properties.color === null)).toBe(true);
    expect(getRequestedUrls(fetchMock).some((url) => url.includes(SHAKEMAP_PATH))).toBe(false);

    await screen.getByRole('button', { name: 'Legend' }).click();
    const legend = screen.getByRole('group', { name: 'Legend' });
    await expect.element(legend.getByText(/^Recreated: the rings/)).toBeVisible();
    expect(legend.getByRole('listitem').elements()).toHaveLength(0);
  });

  it('falls back to rings and circle copy when the contours fail to load', async () => {
    const fetchMock = stubUsgs(usgsPanamaDetail, 500);
    const screen = await renderMap('us6000u18k');

    await expect
      .poll(async () => (await getTrainFeatures()).length, { timeout: 10_000 })
      .toBeGreaterThan(0);
    const features = await getTrainFeatures();
    expect(features.every((feature) => feature.properties.color === null)).toBe(true);
    expect(getRequestedUrls(fetchMock).some((url) => url.endsWith('cont_mmi.json'))).toBe(true);

    await screen.getByRole('button', { name: 'Legend' }).click();
    const legend = screen.getByRole('group', { name: 'Legend' });
    await expect.element(legend.getByText(/^Recreated: the rings/)).toBeVisible();
    expect(legend.getByRole('listitem').elements()).toHaveLength(0);
  });
});
