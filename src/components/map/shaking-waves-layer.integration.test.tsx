import type { CustomRenderMethodInput, Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { EARTH_RADIUS_KM } from '@/lib/earthquakes/distance';
import { getFeltReachKm } from '@/lib/earthquakes/intensity';
import type { Earthquake } from '@/lib/earthquakes/types';
import {
  WAVE_FRONT_STYLES,
  getMercatorX,
  getMercatorY,
  getWaveInstances,
  getWaveStyle,
} from '@/lib/map/shaking-waves';
import type { WaveStyle } from '@/lib/map/shaking-waves';
import type { WaveKind } from '@/lib/shakemap/wave';

import { getShakingWavesLayer, getWaveProgram } from './shaking-waves-layer';

const SQUARE_PX = 1024;
const SPAN_MS = 1_000_000;
const ORIGIN_MS = Date.UTC(2026, 0, 1);
const DEPTH_KM = 10;
const MAGNITUDES = Array.from({ length: 25 }, (_, index) => 2 + index * 0.25);

const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });

type MercatorPoint = { x: number; y: number };
type View = {
  widthPx: number;
  heightPx: number;
  pixelRatio: number;
  zoom: number;
  centre: MercatorPoint;
};
type Frame = { ageMs: number; reducedMotion: boolean };
type Scene = { view: View; earthquake: Earthquake };
type Pixels = { view: View; data: Uint8Array };

function getWorldSize(zoom: number): number {
  return 512 * 2 ** zoom;
}

function getLongitude(x: number): number {
  return x * 360 - 180;
}

function getLatitude(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

function getMainMatrix({ widthPx, heightPx, pixelRatio, zoom, centre }: View): Float64Array {
  const scaleX = (getWorldSize(zoom) * 2 * pixelRatio) / widthPx;
  const scaleY = (getWorldSize(zoom) * 2 * pixelRatio) / heightPx;
  return new Float64Array([
    scaleX,
    0,
    0,
    0,
    0,
    -scaleY,
    0,
    0,
    0,
    0,
    1,
    0,
    -centre.x * scaleX,
    centre.y * scaleY,
    0,
    1,
  ]);
}

function getFakeMap(view: View): MapLibreMap {
  const halfWidth = view.widthPx / view.pixelRatio / 2 / getWorldSize(view.zoom);
  return {
    getZoom: () => view.zoom,
    getPixelRatio: () => view.pixelRatio,
    getCenter: () => ({ lng: getLongitude(view.centre.x), lat: getLatitude(view.centre.y) }),
    getBounds: () => ({
      getWest: () => getLongitude(view.centre.x - halfWidth),
      getEast: () => getLongitude(view.centre.x + halfWidth),
    }),
    triggerRepaint: () => undefined,
  } as unknown as MapLibreMap;
}

function getEarthquake(
  input: Pick<Earthquake, 'magnitude' | 'longitude' | 'latitude'> & { depthKm?: number },
): Earthquake {
  const { magnitude, longitude, latitude, depthKm = DEPTH_KM } = input;
  return {
    id: `eq-${longitude}-${latitude}`,
    source: 'usgs',
    magnitude,
    magnitudeType: 'mw',
    place: null,
    time: ORIGIN_MS,
    depthKm,
    longitude,
    latitude,
    url: 'https://example.com',
  };
}

function getCentredView(earthquake: Earthquake, patch: Partial<View> & Pick<View, 'zoom'>): View {
  return {
    widthPx: SQUARE_PX,
    heightPx: SQUARE_PX,
    pixelRatio: 1,
    centre: { x: getMercatorX(earthquake.longitude), y: getMercatorY(earthquake.latitude) },
    ...patch,
  };
}

function getNorthRadiusPx(view: View, latitude: number, radiusKm: number): number {
  const north = (latitude * Math.PI) / 180 + radiusKm / EARTH_RADIUS_KM;
  const mercator = getMercatorY(latitude) - getMercatorY((north * 180) / Math.PI);
  return mercator * getWorldSize(view.zoom) * view.pixelRatio;
}

function getEastRadiusPx(view: View, latitude: number, radiusKm: number): number {
  const half = Math.sin(radiusKm / EARTH_RADIUS_KM / 2) / Math.cos((latitude * Math.PI) / 180);
  return ((2 * Math.asin(half)) / (2 * Math.PI)) * getWorldSize(view.zoom) * view.pixelRatio;
}

function getScene(zoom: number, latitude: number, pixelRatio = 1): Scene {
  const magnitude = MAGNITUDES.find((candidate) => {
    const earthquake = getEarthquake({ magnitude: candidate, longitude: 0, latitude });
    const view = getCentredView(earthquake, { zoom, pixelRatio });
    const px = getNorthRadiusPx(view, latitude, getFeltReachKm(earthquake));
    return px >= 80 * pixelRatio && px <= 400;
  });
  if (magnitude === undefined) throw new Error(`no magnitude fits zoom ${zoom} lat ${latitude}`);
  const earthquake = getEarthquake({ magnitude, longitude: 0, latitude });
  return { earthquake, view: getCentredView(earthquake, { zoom, pixelRatio }) };
}

function getMagnitudeForReach(targetKm: number): number {
  let low = 0;
  let high = 6;
  for (let step = 0; step < 60; step += 1) {
    const mid = (low + high) / 2;
    if (getFeltReachKm({ magnitude: mid, depthKm: DEPTH_KM }) < targetKm) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return high;
}

function getOracle(earthquake: Earthquake, frame: Frame, wave: WaveKind = 's'): WaveStyle {
  const style = getWaveStyle({
    ...earthquake,
    ...frame,
    wave,
    waveSpanMs: SPAN_MS,
    feltReachKm: getFeltReachKm(earthquake),
  });
  if (!style) throw new Error('the oracle expects a live wave');
  return style;
}

function drawScene(
  context: WebGL2RenderingContext,
  view: View,
  earthquakes: Earthquake[],
  frame: Frame,
): { error: number; pixels: Pixels } {
  canvas.width = view.widthPx;
  canvas.height = view.heightPx;
  const map = getFakeMap(view);
  const waves = getShakingWavesLayer();
  waves.setInstances(getWaveInstances(earthquakes, ORIGIN_MS));
  waves.setFrame({ tMs: ORIGIN_MS + frame.ageMs, waveSpanMs: SPAN_MS, ...frame });
  context.viewport(0, 0, view.widthPx, view.heightPx);
  context.clearColor(0, 0, 0, 0);
  context.clear(context.COLOR_BUFFER_BIT);
  context.enable(context.BLEND);
  context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);
  waves.layer.onAdd?.(map, context);
  waves.layer.render(context, {
    defaultProjectionData: { mainMatrix: getMainMatrix(view) },
  } as unknown as CustomRenderMethodInput);
  const error = context.getError();
  const data = new Uint8Array(view.widthPx * view.heightPx * 4);
  context.readPixels(0, 0, view.widthPx, view.heightPx, context.RGBA, context.UNSIGNED_BYTE, data);
  waves.layer.onRemove?.(map, context);
  return { error, pixels: { view, data } };
}

function getPixel({ view, data }: Pixels, x: number, y: number): Uint8Array {
  const index = (y * view.widthPx + x) * 4;
  return data.subarray(index, index + 4);
}

function getEastRay(pixels: Pixels): Uint8Array[] {
  const centreX = pixels.view.widthPx / 2;
  const centreY = pixels.view.heightPx / 2;
  return Array.from({ length: centreX }, (_, step) => getPixel(pixels, centreX + step, centreY));
}

function getNorthRay(pixels: Pixels): Uint8Array[] {
  const centreX = pixels.view.widthPx / 2;
  const centreY = pixels.view.heightPx / 2;
  return Array.from({ length: centreY }, (_, step) => getPixel(pixels, centreX, centreY + step));
}

function getRingOffsetPx(ray: Uint8Array[]): number {
  const total = ray.reduce((sum, pixel) => sum + pixel[3], 0);
  const weighted = ray.reduce((sum, pixel, step) => sum + pixel[3] * (step + 0.5), 0);
  return weighted / total;
}

function getBands(ray: Uint8Array[]): Uint8Array[][] {
  return ray.reduce<{ bands: Uint8Array[][]; open: boolean }>(
    ({ bands, open }, pixel) => {
      if (pixel[3] === 0) return { bands, open: false };
      if (open) bands[bands.length - 1].push(pixel);
      else bands.push([pixel]);
      return { bands, open: true };
    },
    { bands: [], open: false },
  ).bands;
}

function getBandOffsetPx(ray: Uint8Array[], band: Uint8Array[]): number {
  return getRingOffsetPx(ray.map((pixel) => (band.includes(pixel) ? pixel : new Uint8Array(4))));
}

function getPeakPixel(ray: Uint8Array[]): Uint8Array {
  return ray.reduce((peak, pixel) => (pixel[3] > peak[3] ? pixel : peak), ray[0]);
}

function getRingCentroid(pixels: Pixels): MercatorPoint {
  let x = 0;
  let y = 0;
  let total = 0;
  for (let row = 0; row < pixels.view.heightPx; row += 1) {
    for (let column = 0; column < pixels.view.widthPx; column += 1) {
      const alpha = getPixel(pixels, column, row)[3];
      x += alpha * (column + 0.5);
      y += alpha * (row + 0.5);
      total += alpha;
    }
  }
  return { x: x / total, y: y / total };
}

function getEpicentrePx(view: View, earthquake: Earthquake): MercatorPoint {
  const devicePerMercator = getWorldSize(view.zoom) * view.pixelRatio;
  const offsetX = getMercatorX(earthquake.longitude) - view.centre.x;
  const offsetY = getMercatorY(earthquake.latitude) - view.centre.y;
  return {
    x: view.widthPx / 2 + offsetX * devicePerMercator,
    y: view.heightPx / 2 - offsetY * devicePerMercator,
  };
}

function getColumnAlpha(pixels: Pixels, fromX: number, toX: number): number {
  let total = 0;
  for (let row = 0; row < pixels.view.heightPx; row += 1) {
    for (let column = fromX; column < toX; column += 1) total += getPixel(pixels, column, row)[3];
  }
  return total;
}

function expectPeakToMatch(peak: Uint8Array, style: WaveStyle) {
  expect(Math.abs(peak[3] - style.opacity * 255)).toBeLessThanOrEqual(3);
  style.color.forEach((channel, index) => {
    expect(Math.abs(peak[index] - channel * style.opacity * 255)).toBeLessThanOrEqual(3);
  });
}

describe('shaking waves WebGL2 layer', () => {
  const context = gl as WebGL2RenderingContext;

  it('runs on a WebGL2 context', () => {
    expect(
      gl,
      'WebGL2 is unavailable in this browser, so the shader cannot be verified',
    ).not.toBeNull();
  });

  it('compiles and links the wave program', () => {
    const program = getWaveProgram(context);
    expect(context.getProgramParameter(program, context.LINK_STATUS)).toBe(true);
    expect(context.getError()).toBe(context.NO_ERROR);
    context.deleteProgram(program);
  });

  it('draws several instances across world copies without GL errors', () => {
    const quakes = [
      [0, 0, 5],
      [179.5, 10, 6],
      [-179.5, -20, 4.5],
    ].map(([longitude, latitude, magnitude]) => getEarthquake({ magnitude, longitude, latitude }));
    const view = getCentredView(quakes[0], { zoom: 2 });
    const { error } = drawScene(context, view, quakes, {
      ageMs: SPAN_MS / 2,
      reducedMotion: false,
    });

    expect(error).toBe(context.NO_ERROR);
    expect(context.getError()).toBe(context.NO_ERROR);
  });

  it.each([
    [4, 0],
    [4, 45],
    [6, 30],
    [6, 60],
    [8, -15],
    [8, 52],
    [8, 70],
  ])(
    'at zoom %d, latitude %d the reduced-motion ring sits at the felt reach ± 5 %',
    (zoom, latitude) => {
      const { view, earthquake } = getScene(zoom, latitude);
      const frame = { ageMs: SPAN_MS * 0.01, reducedMotion: true };
      const { radiusKm } = getOracle(earthquake, frame);
      const { error, pixels } = drawScene(context, view, [earthquake], frame);

      expect(error).toBe(context.NO_ERROR);
      const north = getRingOffsetPx(getNorthRay(pixels));
      const east = getRingOffsetPx(getEastRay(pixels));
      expect(Math.abs(north / getNorthRadiusPx(view, latitude, radiusKm) - 1)).toBeLessThan(0.05);
      expect(Math.abs(east / getEastRadiusPx(view, latitude, radiusKm) - 1)).toBeLessThan(0.05);
    },
  );

  it('draws the P front ahead of the S front, each at its real-speed radius and front intensity', () => {
    const { view, earthquake } = getScene(6, 40);
    const frame = { ageMs: SPAN_MS * 0.5, reducedMotion: false };
    const s = getOracle(earthquake, frame, 's');
    const p = getOracle(earthquake, frame, 'p');
    const { error, pixels } = drawScene(context, view, [earthquake], frame);
    const ray = getEastRay(pixels);
    const [inner, outer] = getBands(ray);

    expect(error).toBe(context.NO_ERROR);
    expect(getBands(ray)).toHaveLength(2);
    expect(p.radiusKm).toBeGreaterThan(s.radiusKm);
    expect(
      Math.abs(getBandOffsetPx(ray, inner) / getEastRadiusPx(view, 40, s.radiusKm) - 1),
    ).toBeLessThan(0.05);
    expect(
      Math.abs(getBandOffsetPx(ray, outer) / getEastRadiusPx(view, 40, p.radiusKm) - 1),
    ).toBeLessThan(0.05);
    expectPeakToMatch(getPeakPixel(inner), s);
    const peak = getPeakPixel(outer);
    p.color.forEach((channel, index) => {
      expect(Math.abs(peak[index] / peak[3] - channel)).toBeLessThan(0.05);
    });
  });

  it('draws the P front band half as wide as the S front band', () => {
    const { view, earthquake } = getScene(6, 40);
    const frame = { ageMs: SPAN_MS * 0.5, reducedMotion: false };
    const { pixels } = drawScene(context, view, [earthquake], frame);
    const [inner, outer] = getBands(getEastRay(pixels));
    const getWidthPx = (band: Uint8Array[], style: WaveStyle) =>
      band.reduce((sum, pixel) => sum + pixel[3], 0) / (style.opacity * 255);

    const sWidthPx = getWidthPx(inner, getOracle(earthquake, frame, 's'));
    const pWidthPx = getWidthPx(outer, getOracle(earthquake, frame, 'p'));

    expect(Math.abs(sWidthPx - WAVE_FRONT_STYLES.s.bandHalfPx * 2)).toBeLessThan(0.5);
    expect(Math.abs(pWidthPx - WAVE_FRONT_STYLES.p.bandHalfPx * 2)).toBeLessThan(0.5);
  });

  it('drops the P front once it passes the felt reach and keeps the S front', () => {
    const { view, earthquake } = getScene(6, 40);
    const frame = { ageMs: SPAN_MS * 0.8, reducedMotion: false };
    const s = getOracle(earthquake, frame, 's');
    const { error, pixels } = drawScene(context, view, [earthquake], frame);
    const ray = getEastRay(pixels);

    expect(error).toBe(context.NO_ERROR);
    expect(getBands(ray)).toHaveLength(1);
    expect(Math.abs(getRingOffsetPx(ray) / getEastRadiusPx(view, 40, s.radiusKm) - 1)).toBeLessThan(
      0.05,
    );
  });

  it('draws nothing while both fronts are still climbing from the Depth', () => {
    const earthquake = getEarthquake({ magnitude: 7, longitude: 0, latitude: 0, depthKm: 200 });
    const view = getCentredView(earthquake, { zoom: 4 });
    const { error, pixels } = drawScene(context, view, [earthquake], {
      ageMs: SPAN_MS * 0.01,
      reducedMotion: false,
    });

    expect(error).toBe(context.NO_ERROR);
    expect(getFeltReachKm(earthquake)).toBeGreaterThan(0);
    expect(pixels.data.some((value) => value > 0)).toBe(false);
  });

  it('colours the reduced-motion ring by the epicentral intensity and fades it over the wave life', () => {
    const { view, earthquake } = getScene(6, 40);
    const frame = { ageMs: SPAN_MS * 0.25, reducedMotion: true };
    const style = getOracle(earthquake, frame);
    const { error, pixels } = drawScene(context, view, [earthquake], frame);

    expect(error).toBe(context.NO_ERROR);
    expect(style.opacity).toBeGreaterThan(0.5);
    expectPeakToMatch(getPeakPixel(getEastRay(pixels)), style);
  });

  it.each([
    [1, 2],
    [2, 4],
  ])('at device pixel ratio %d the band is %d device px wide', (pixelRatio, bandPx) => {
    const { view, earthquake } = getScene(6, 20, pixelRatio);
    const frame = { ageMs: SPAN_MS * 0.01, reducedMotion: true };
    const style = getOracle(earthquake, frame);
    const { error, pixels } = drawScene(context, view, [earthquake], frame);
    const ray = getEastRay(pixels);
    const alpha = ray.reduce((sum, pixel) => sum + pixel[3], 0);

    expect(error).toBe(context.NO_ERROR);
    expect(Math.abs(alpha / (style.opacity * 255) - bandPx)).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(getRingOffsetPx(ray) / getEastRadiusPx(view, 20, style.radiusKm) - 1),
    ).toBeLessThan(0.05);
  });

  it.each([16, 18])(
    'at zoom %d the ring follows a 1 px pan without jitter and keeps the felt reach ± 5 %',
    (zoom) => {
      const longitude = 139.6917;
      const latitude = 35.6895;
      const worldSize = getWorldSize(zoom);
      const kmPerPx =
        (2 * Math.PI * EARTH_RADIUS_KM * Math.cos((latitude * Math.PI) / 180)) / worldSize;
      const magnitude = getMagnitudeForReach(250 * kmPerPx);
      const earthquake = getEarthquake({ magnitude, longitude, latitude });
      const frame = { ageMs: SPAN_MS * 0.01, reducedMotion: true };
      const { radiusKm } = getOracle(earthquake, frame);
      const base = getCentredView(earthquake, { zoom });
      const centre = { x: base.centre.x + 0.37 / worldSize, y: base.centre.y + 0.21 / worldSize };
      const panned = { x: centre.x + 1 / worldSize, y: centre.y };
      const [first, second] = [centre, panned].map((point) =>
        drawScene(context, { ...base, centre: point }, [earthquake], frame),
      );
      const [firstCentroid, secondCentroid] = [first, second].map(({ pixels }) =>
        getRingCentroid(pixels),
      );

      expect(first.error).toBe(context.NO_ERROR);
      expect(second.error).toBe(context.NO_ERROR);
      [first, second].forEach(({ pixels }, index) => {
        const expected = getEpicentrePx(pixels.view, earthquake);
        const centroid = [firstCentroid, secondCentroid][index];
        expect(Math.abs(centroid.x - expected.x)).toBeLessThanOrEqual(0.25);
        expect(Math.abs(centroid.y - expected.y)).toBeLessThanOrEqual(0.25);
      });
      expect(Math.abs(firstCentroid.x - secondCentroid.x - 1)).toBeLessThanOrEqual(0.25);
      expect(Math.abs(firstCentroid.y - secondCentroid.y)).toBeLessThanOrEqual(0.25);
      [first, second].forEach(({ pixels }) => {
        const east = getRingOffsetPx(getEastRay(pixels));
        const north = getRingOffsetPx(getNorthRay(pixels));
        expect(Math.abs(east / getEastRadiusPx(base, latitude, radiusKm) - 1)).toBeLessThan(0.05);
        expect(Math.abs(north / getNorthRadiusPx(base, latitude, radiusKm) - 1)).toBeLessThan(0.05);
      });
    },
  );

  it('draws the ring on every world copy a wide zoom 0 view shows', () => {
    const earthquake = getEarthquake({ magnitude: 8, longitude: 0, latitude: 0 });
    const view = getCentredView(earthquake, { zoom: 0, widthPx: 2560, heightPx: 256 });
    const { error, pixels } = drawScene(context, view, [earthquake], {
      ageMs: SPAN_MS * 0.01,
      reducedMotion: true,
    });
    const copyCentres = [-2, -1, 0, 1, 2].map((copy) => view.widthPx / 2 + copy * 512);

    expect(error).toBe(context.NO_ERROR);
    copyCentres.forEach((centreX) => {
      expect(getColumnAlpha(pixels, centreX - 100, centreX + 100)).toBeGreaterThan(0);
    });
  });

  it('draws nothing before the earthquake or after the wave span', () => {
    const { view, earthquake } = getScene(6, 0);
    const early = drawScene(context, view, [earthquake], { ageMs: -1, reducedMotion: false });
    const late = drawScene(context, view, [earthquake], {
      ageMs: SPAN_MS + 1,
      reducedMotion: true,
    });

    expect(early.pixels.data.some((value) => value > 0)).toBe(false);
    expect(late.pixels.data.some((value) => value > 0)).toBe(false);
  });
});
