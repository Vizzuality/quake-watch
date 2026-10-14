import { describe, expect, it } from 'vitest';

import { getDistanceKm } from '@/lib/earthquakes/distance';
import { getMercatorY } from '@/lib/map/shaking-waves';
import { shakemapCoverage } from '@/test/fixtures/shakemap-coverage';

import {
  FILL_MIN_MMI,
  getCanvasPoint,
  getGridMaxMmi,
  getShakemapCanvasSize,
  getShakemapCorners,
  getSurfaceRaster,
} from './canvas';
import { getPaletteColor, getShakemapGrid } from './coverage';
import type { ShakemapGrid } from './coverage';
import { type PulseRaster, SETTLED_ALPHA, getPulseFrameBuffer, paintPulseFrame } from './pulse';
import { S_WAVE_KM_S, getArrivalSeconds } from './wave';

const grid = getShakemapGrid(shakemapCoverage);

function getGrid(overrides: Partial<ShakemapGrid>): ShakemapGrid {
  return { ...grid, ...overrides };
}

function getPixel(pixels: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return Array.from(pixels.slice(offset, offset + 4));
}

function getExpectedPixel(mmi: number): number[] {
  const [red, green, blue] = getPaletteColor(grid.palette, mmi);
  return Array.from(Uint8ClampedArray.of(red * 255, green * 255, blue * 255, SETTLED_ALPHA));
}

describe('getShakemapCorners', () => {
  it('lists the grid bbox clockwise from the north-west corner', () => {
    expect(getShakemapCorners(grid)).toEqual([
      [grid.west, grid.north],
      [grid.east, grid.north],
      [grid.east, grid.south],
      [grid.west, grid.south],
    ]);
  });
});

describe('getShakemapCanvasSize', () => {
  it('fits the long side and keeps the Web Mercator aspect ratio', () => {
    const size = getShakemapCanvasSize(grid, 1000);
    const mercatorWidth = (grid.east - grid.west) / 360;
    const mercatorHeight = getMercatorY(grid.south) - getMercatorY(grid.north);

    expect(Math.max(size.width, size.height)).toBe(1000);
    expect(size.width / size.height).toBeCloseTo(mercatorWidth / mercatorHeight, 2);
  });

  it('never returns an empty canvas', () => {
    const size = getShakemapCanvasSize(getGrid({ west: 0, east: 0.0001 }), 10);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });
});

describe('getCanvasPoint', () => {
  const size = { width: 200, height: 100 };

  it('maps the grid corners to the canvas corners', () => {
    expect(getCanvasPoint(grid, size, [grid.west, grid.north])).toEqual([0, 0]);
    const [x, y] = getCanvasPoint(grid, size, [grid.east, grid.south]);
    expect(x).toBeCloseTo(200);
    expect(y).toBeCloseTo(100);
  });

  it('places latitudes in Web Mercator, not linearly', () => {
    const tall = getGrid({ south: 0, north: 80 });
    const [, y] = getCanvasPoint(tall, size, [tall.west, 40]);
    const expected =
      ((getMercatorY(40) - getMercatorY(80)) / (getMercatorY(0) - getMercatorY(80))) * 100;
    expect(y).toBeCloseTo(expected);
    expect(y).toBeGreaterThan(60);
  });

  it('frames longitudes across the antimeridian', () => {
    const pacific = getGrid({ west: 170, east: 190 });
    const [x] = getCanvasPoint(pacific, size, [-175, 0]);
    expect(x).toBeCloseTo(150);
  });
});

const strongGrid = getGrid({
  west: 0,
  east: 4,
  south: 0,
  north: 3,
  columns: 5,
  rows: 4,
  values: Float32Array.from([
    3.9,
    4,
    5,
    8,
    2,
    3.99,
    4.01,
    Number.NaN,
    6,
    1,
    7,
    7,
    7,
    7,
    7,
    0.5,
    9,
    3,
    4,
    10,
  ]),
});

function getSettledPixels(raster: PulseRaster): Uint8ClampedArray {
  const pixels = getPulseFrameBuffer(raster);
  paintPulseFrame(pixels, raster, 0, true);
  return pixels;
}

describe('getSurfaceRaster', () => {
  const size = { width: strongGrid.columns, height: strongGrid.rows };
  const epicenter = { latitude: 0, longitude: 0 };

  it('fills only from Intensity IV in the palette color', () => {
    expect(FILL_MIN_MMI).toBe(4);
    const pixels = getSettledPixels(getSurfaceRaster(strongGrid, size, epicenter, 10));

    expect(pixels).toHaveLength(strongGrid.columns * strongGrid.rows * 4);
    expect(getPixel(pixels, size.width, 0, size.height - 1)[3]).toBe(0);
    expect(getPixel(pixels, size.width, 1, size.height - 1)).toEqual(getExpectedPixel(4));
    expect(getPixel(pixels, size.width, 2, size.height - 1)).toEqual(getExpectedPixel(5));
  });

  it('keeps Intensity II-III and missing cells transparent', () => {
    const pixels = getSettledPixels(getSurfaceRaster(strongGrid, size, epicenter, 10));
    expect(getPixel(pixels, size.width, 4, size.height - 1)[3]).toBe(0);
    expect(getPixel(pixels, size.width, 0, 0)[3]).toBe(0);
    expect(getPixel(pixels, size.width, 0, 2)[3]).toBe(0);
    expect(getPixel(pixels, size.width, 2, 2)[3]).toBe(0);
  });

  it('has no points for a grid that never reaches IV', () => {
    const raster = getSurfaceRaster(grid, { width: grid.columns, height: grid.rows }, epicenter, 0);
    expect(raster.pixels).toHaveLength(0);
  });

  it('samples rows by Web Mercator latitude so the surface lines up with the basemap', () => {
    const tall = getGrid({
      west: 0,
      east: 10,
      south: 0,
      north: 80,
      columns: 2,
      rows: 3,
      values: Float32Array.from([5, 5, 6, 6, 9, 9]),
    });
    const pixels = getSettledPixels(
      getSurfaceRaster(tall, { width: 2, height: 100 }, epicenter, 0),
    );

    expect(getPixel(pixels, 2, 0, 40)).toEqual(getExpectedPixel(9));
    expect(getPixel(pixels, 2, 0, 99)).toEqual(getExpectedPixel(5));
  });

  it('gives each point its hypocentral S arrival', () => {
    const strip = getGrid({
      west: 0,
      east: 2,
      south: 0,
      north: 0.001,
      columns: 2,
      rows: 2,
      values: Float32Array.from([6, 6, 6, 6]),
    });
    const raster = getSurfaceRaster(strip, { width: 4, height: 1 }, epicenter, 10);
    const expected = getArrivalSeconds(
      getDistanceKm(epicenter, { latitude: 0.0005, longitude: 0.75 }),
      10,
      S_WAVE_KM_S,
    );
    expect(raster.pixels[1]).toBe(1);
    expect(raster.arrivals[1]).toBeCloseTo(expected, 1);
    expect(raster.intensities[1]).toBe(6);
  });

  it('shifts every arrival later when the Depth grows', () => {
    const shallow = getSurfaceRaster(strongGrid, size, epicenter, 0);
    const deep = getSurfaceRaster(strongGrid, size, epicenter, 100);
    expect(shallow.arrivals.length).toBeGreaterThan(0);
    expect(shallow.arrivals.every((arrival, index) => deep.arrivals[index] > arrival)).toBe(true);
  });
});

describe('getGridMaxMmi', () => {
  it('returns the strongest Intensity, ignoring missing cells', () => {
    expect(getGridMaxMmi(grid)).toBeCloseTo(3.2);
  });

  it('returns null when every cell is missing', () => {
    expect(getGridMaxMmi(getGrid({ values: Float32Array.from([Number.NaN]) }))).toBeNull();
  });
});
