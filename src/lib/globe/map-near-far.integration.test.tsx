import { Map as MapLibreMap, type ProjectionSpecification, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { MAP_FIELD_OF_VIEW, getMapProjection } from './map-handover';
import { setMapNearFarZ } from './map-near-far';

setWorkerUrl(workerUrl);

const DETAIL_PADDING = { top: 0, bottom: 116, left: 476, right: 0 };
const CAMERAS = [
  { center: [12, 25], zoom: 6.1 },
  { center: [12, 25], zoom: 5.7 },
  { center: [12, 44], zoom: 4.8 },
  { center: [12, 0], zoom: 7.5 },
] as const;

let map: MapLibreMap | null = null;
let container: HTMLDivElement | null = null;

async function createMap() {
  await page.viewport(1440, 900);
  container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0';
  document.body.append(container);
  map = new MapLibreMap({ container, style: { version: 8, sources: {}, layers: [] } });
  await new Promise<void>((resolve) => map?.once('load', () => resolve()));
  map.setProjection(getMapProjection(4.34) as ProjectionSpecification);
  map.setVerticalFieldOfView(MAP_FIELD_OF_VIEW);
  setMapNearFarZ(map);
  return map;
}

function getMercatorPoint(lng: number, lat: number): [number, number] {
  const y = (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
  return [(lng + 180) / 360, y];
}

async function getUncoveredPointCount(map: MapLibreMap): Promise<number> {
  map.triggerRepaint();
  await new Promise((resolve) => map.once('render', resolve));
  const tiles = map.coveringTiles({ tileSize: 512 }).map((id) => id.canonical);
  const { clientWidth: width, clientHeight: height } = map.getContainer();
  let count = 0;
  for (let i = 0; i <= 12; i++) {
    for (let j = 0; j <= 12; j++) {
      const { lng, lat } = map.unproject([((width - 1) * i) / 12, ((height - 1) * j) / 12]);
      const [x, y] = getMercatorPoint(lng, lat);
      const isCovered = tiles.some(
        (tile) => Math.floor(x * 2 ** tile.z) === tile.x && Math.floor(y * 2 ** tile.z) === tile.y,
      );
      if (!isCovered) count++;
    }
  }
  return count;
}

async function getUncoveredCounts(): Promise<number[]> {
  const map = await createMap();
  const counts: number[] = [];
  for (const { center, zoom } of CAMERAS) {
    map.jumpTo({ center: [...center], zoom, padding: DETAIL_PADDING });
    counts.push(await getUncoveredPointCount(map));
  }
  return counts;
}

describe('setMapNearFarZ', () => {
  afterEach(async () => {
    map?.remove();
    container?.remove();
    map = null;
    container = null;
    await page.viewport(1280, 800);
  });

  it('requests tiles for every point of a padded globe-projection view', async () => {
    expect(await getUncoveredCounts()).toEqual(CAMERAS.map(() => 0));
  });
});
