import type { GeoJSONSource } from 'maplibre-gl';
import { useEffect } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { useMap } from 'react-map-gl/maplibre';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { Earthquake } from '@/lib/earthquakes/types';
import {
  TRAIN_CROSS_MS,
  getTrainBounds,
  getTrainFronts,
  getWaveTrainShape,
} from '@/lib/shakemap/wave-train';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { WaveTrainMap } from './wave-train-map';

const BASEMAP_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background' }],
};
const PLAY_NAME = 'Play the seismic waves';
const PAUSE_NAME = 'Pause the seismic waves';
const LEGEND_TEXT = 'Legend body';
const EARTHQUAKE: Earthquake = {
  id: 'us-test',
  source: 'usgs',
  magnitude: 6,
  magnitudeType: 'mw',
  place: 'Test',
  time: Date.UTC(2026, 0, 1),
  depthKm: 10,
  longitude: -80,
  latitude: 8,
  url: 'https://earthquake.usgs.gov/',
};
const SHAPE = getWaveTrainShape(null, EARTHQUAKE);
const BOUNDS = getTrainBounds(SHAPE, EARTHQUAKE);
const FRAME_GAP_MS = 300;
const mapRef: { current: MapRef | undefined } = { current: undefined };

function MapProbe() {
  const { current } = useMap();
  useEffect(() => {
    mapRef.current = current;
  }, [current]);
  return null;
}

async function renderMap() {
  const { screen } = await renderWithRouter(() => (
    <WaveTrainMap
      earthquake={EARTHQUAKE}
      shape={SHAPE}
      bounds={BOUNDS}
      legend={<p>{LEGEND_TEXT}</p>}
    >
      <MapProbe />
    </WaveTrainMap>
  ));
  return screen;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTrainData(): Promise<string | null> {
  const source = mapRef.current?.getMap().getSource<GeoJSONSource>('wave-train');
  if (!source) return null;
  return JSON.stringify(await source.getData());
}

async function getTrainFeatureCount(): Promise<number> {
  const source = mapRef.current?.getMap().getSource<GeoJSONSource>('wave-train');
  if (!source) return 0;
  const data = await source.getData();
  return data.type === 'FeatureCollection' ? data.features.length : 0;
}

async function getFramePair(): Promise<[string | null, string | null]> {
  const first = await getTrainData();
  await wait(FRAME_GAP_MS);
  return [first, await getTrainData()];
}

async function waitForTrainSource() {
  await expect.poll(getTrainData, { timeout: 10_000 }).not.toBeNull();
}

function stubHiddenPage() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
}

function stubReducedMotionFlip() {
  const state = { matches: false };
  const listeners = new Set<(event: Event) => void>();
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    if (query !== '(prefers-reduced-motion: reduce)') return matchMedia(query);
    return {
      get matches() {
        return state.matches;
      },
      media: query,
      addEventListener: (_: string, listener: (event: Event) => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: (event: Event) => void) =>
        listeners.delete(listener),
    } as unknown as MediaQueryList;
  });
  return () => {
    state.matches = true;
    for (const listener of listeners) listener(new Event('change'));
  };
}

function stubReducedMotion() {
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
    query === '(prefers-reduced-motion: reduce)'
      ? ({
          matches: true,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        } as unknown as MediaQueryList)
      : matchMedia(query),
  );
}

describe('WaveTrainMap', () => {
  beforeEach(() => {
    stubFetch([
      {
        match: (url) => url.hostname === 'tiles.openfreemap.org',
        respond: () => Response.json(BASEMAP_STYLE),
      },
      { match: () => true, respond: () => new Response(null, { status: 404 }) },
    ]);
  });

  afterEach(() => {
    mapRef.current = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mounts without errors and stacks the wave train below the epicenter marker', async () => {
    const consoleError = vi.spyOn(console, 'error');
    await renderMap();
    await waitForTrainSource();
    await expect
      .poll(() => mapRef.current?.getMap().getLayer('detail-earthquake-core'))
      .toBeDefined();
    const ids = (mapRef.current?.getMap().getStyle().layers ?? []).map(({ id }) => id);
    const halo = ids.indexOf('detail-earthquake-halo');
    expect(halo).toBeGreaterThan(-1);
    expect(ids.indexOf('wave-train-halo')).toBeGreaterThan(-1);
    expect(ids.indexOf('wave-train-halo')).toBeLessThan(halo);
    expect(ids.indexOf('wave-train-line')).toBeLessThan(halo);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('toggles the play and pause label', async () => {
    const screen = await renderMap();
    const button = screen.getByRole('button', { name: PAUSE_NAME });
    await expect.element(button).toBeInTheDocument();
    await button.click();
    await expect.element(screen.getByRole('button', { name: PLAY_NAME })).toBeInTheDocument();
    await screen.getByRole('button', { name: PLAY_NAME }).click();
    await expect.element(screen.getByRole('button', { name: PAUSE_NAME })).toBeInTheDocument();
  });

  it('opens the legend panel and closes it with Escape, returning focus to the button', async () => {
    const screen = await renderMap();
    const legendButton = screen.getByRole('button', { name: 'Legend' });
    await expect.element(legendButton).toHaveAttribute('aria-expanded', 'false');
    await expect.element(screen.getByText(LEGEND_TEXT)).not.toBeVisible();

    await legendButton.click();
    await expect.element(legendButton).toHaveAttribute('aria-expanded', 'true');
    await expect.element(screen.getByText(LEGEND_TEXT)).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.element(legendButton).toHaveAttribute('aria-expanded', 'false');
    await expect.element(screen.getByText(LEGEND_TEXT)).not.toBeVisible();
    await expect.element(legendButton).toHaveFocus();
  });

  it('leaves the legend open and focus in place on Escape from outside the controls', async () => {
    const screen = await renderMap();
    const legendButton = screen.getByRole('button', { name: 'Legend' });
    await legendButton.click();
    await expect.element(legendButton).toHaveAttribute('aria-expanded', 'true');

    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    await userEvent.keyboard('{Escape}');
    await expect.element(legendButton).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('starts paused when the user prefers reduced motion', async () => {
    stubReducedMotion();
    const screen = await renderMap();
    await expect.element(screen.getByRole('button', { name: PLAY_NAME })).toBeInTheDocument();
  });

  it('feeds at least one front to the line source', async () => {
    await renderMap();
    await expect.poll(getTrainFeatureCount, { timeout: 10_000 }).toBeGreaterThan(0);
  });

  it('keeps the map static', async () => {
    await renderMap();
    await waitForTrainSource();
    const map = mapRef.current?.getMap();
    expect(map?.dragPan.isEnabled()).toBe(false);
    expect(map?.scrollZoom.isEnabled()).toBe(false);
  });

  it('advances the fronts while playing and freezes them while paused', async () => {
    const screen = await renderMap();
    await waitForTrainSource();
    const initial = await getTrainData();
    await expect.poll(getTrainData, { timeout: 5_000 }).not.toBe(initial);

    await screen.getByRole('button', { name: PAUSE_NAME }).click();
    await expect.element(screen.getByRole('button', { name: PLAY_NAME })).toBeInTheDocument();
    await wait(FRAME_GAP_MS);
    const [first, second] = await getFramePair();
    expect(second).toBe(first);
  });

  it('freezes the fronts at the reduced-motion frame', async () => {
    stubReducedMotion();
    await renderMap();
    await waitForTrainSource();
    const expected = getTrainFronts(
      SHAPE,
      { latitude: EARTHQUAKE.latitude, longitude: EARTHQUAKE.longitude },
      TRAIN_CROSS_MS * 0.6,
    );
    await expect.poll(getTrainData).toBe(JSON.stringify(expected));
    const [first, second] = await getFramePair();
    expect(second).toBe(first);
  });

  it('freezes the fronts when reduced motion turns on mid-play', async () => {
    const turnOnReducedMotion = stubReducedMotionFlip();
    const screen = await renderMap();
    await waitForTrainSource();
    await expect.element(screen.getByRole('button', { name: PAUSE_NAME })).toBeInTheDocument();

    turnOnReducedMotion();
    await expect.element(screen.getByRole('button', { name: PLAY_NAME })).toBeInTheDocument();
    const expected = getTrainFronts(
      SHAPE,
      { latitude: EARTHQUAKE.latitude, longitude: EARTHQUAKE.longitude },
      TRAIN_CROSS_MS * 0.6,
    );
    await expect.poll(getTrainData).toBe(JSON.stringify(expected));
  });

  it('freezes the fronts while the tab is hidden', async () => {
    await renderMap();
    await waitForTrainSource();
    const initial = await getTrainData();
    await expect.poll(getTrainData, { timeout: 5_000 }).not.toBe(initial);
    stubHiddenPage();
    await wait(FRAME_GAP_MS);
    const [first, second] = await getFramePair();
    expect(second).toBe(first);
  });
});
