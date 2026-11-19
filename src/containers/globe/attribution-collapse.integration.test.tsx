import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

import 'maplibre-gl/dist/maplibre-gl.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

import { watchAttributionCollapse } from './attribution-collapse';

const COLLAPSE_MS = 5000;
const SHOWN_CLASS = 'maplibregl-compact-show';

setWorkerUrl(workerUrl);

let map: MapLibreMap | null = null;
let container: HTMLDivElement | null = null;

async function createMap() {
  container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0';
  document.body.append(container);
  map = new MapLibreMap({
    container,
    style: { version: 8, sources: {}, layers: [] },
    attributionControl: { compact: true, customAttribution: 'OpenStreetMap' },
  });
  await new Promise<void>((resolve) => map?.once('load', () => resolve()));
  return {
    map,
    attribution: container.querySelector('.maplibregl-ctrl-attrib') as HTMLElement,
  };
}

describe('attribution collapse', () => {
  afterEach(async () => {
    vi.useRealTimers();
    map?.remove();
    container?.remove();
    map = null;
    container = null;
    await page.viewport(1280, 800);
  });

  it('shows the attribution when the map first appears on a phone and collapses it after 5 s', async () => {
    await page.viewport(390, 844);
    const { map, attribution } = await createMap();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const collapse = watchAttributionCollapse(map);

    collapse.onMapShown();
    expect(attribution.classList.contains(SHOWN_CLASS)).toBe(true);
    vi.advanceTimersByTime(COLLAPSE_MS - 1);
    expect(attribution.classList.contains(SHOWN_CLASS)).toBe(true);
    vi.advanceTimersByTime(1);

    expect(attribution.classList.contains(SHOWN_CLASS)).toBe(false);
    attribution.querySelector('summary')?.click();
    expect(attribution.classList.contains(SHOWN_CLASS)).toBe(true);
    collapse.dispose();
  });

  it('waits for the map to appear before counting', async () => {
    await page.viewport(390, 844);
    const { map, attribution } = await createMap();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const collapse = watchAttributionCollapse(map);

    vi.advanceTimersByTime(COLLAPSE_MS * 2);

    expect(attribution.classList.contains(SHOWN_CLASS)).toBe(true);
    collapse.dispose();
  });

  it('leaves the attribution alone once the reader has toggled it', async () => {
    await page.viewport(390, 844);
    const { map, attribution } = await createMap();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const collapse = watchAttributionCollapse(map);
    collapse.onMapShown();

    attribution.querySelector('summary')?.click();
    attribution.querySelector('summary')?.click();
    vi.advanceTimersByTime(COLLAPSE_MS);

    expect(attribution.classList.contains(SHOWN_CLASS)).toBe(true);
    collapse.dispose();
  });

  it('stops the timer when disposed', async () => {
    await page.viewport(390, 844);
    const { map, attribution } = await createMap();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const collapse = watchAttributionCollapse(map);
    collapse.onMapShown();

    collapse.dispose();
    vi.advanceTimersByTime(COLLAPSE_MS);

    expect(attribution.classList.contains(SHOWN_CLASS)).toBe(true);
  });

  it('keeps the desktop attribution as MapLibre shows it at 1024 px', async () => {
    await page.viewport(1024, 768);
    const { map, attribution } = await createMap();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const before = attribution.className;
    const collapse = watchAttributionCollapse(map);
    collapse.onMapShown();

    vi.advanceTimersByTime(COLLAPSE_MS * 2);

    expect(attribution.className).toBe(before);
    collapse.dispose();
  });
});
