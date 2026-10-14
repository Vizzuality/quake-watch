import { describe, expect, it } from 'vitest';

import { getMercatorY } from '@/lib/map/shaking-waves';
import { shakemapContours } from '@/test/fixtures/shakemap-contours';
import { shakemapCoverage } from '@/test/fixtures/shakemap-coverage';

import {
  getCanvasPoint,
  getContourPaths,
  getGridMaxMmi,
  getRevealOutline,
  getShakemapCanvasSize,
  getShakemapCorners,
  getSurfaceAlpha,
  getSurfacePixels,
} from './canvas';
import { getShakemapContours } from './contours';
import { getPaletteColor, getShakemapGrid } from './coverage';
import type { ShakemapGrid } from './coverage';

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
  return Array.from(
    Uint8ClampedArray.of(red * 255, green * 255, blue * 255, getSurfaceAlpha(mmi) * 255),
  );
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

describe('getSurfaceAlpha', () => {
  it('hides Intensity I and fades in up to II', () => {
    expect(getSurfaceAlpha(0.5)).toBe(0);
    expect(getSurfaceAlpha(1)).toBe(0);
    expect(getSurfaceAlpha(1.5)).toBeCloseTo(0.175);
  });

  it('keeps low felt Intensity faint and reaches full opacity at V', () => {
    expect(getSurfaceAlpha(2)).toBeCloseTo(0.35);
    expect(getSurfaceAlpha(3.5)).toBeCloseTo(0.675);
    expect(getSurfaceAlpha(5)).toBe(1);
    expect(getSurfaceAlpha(8)).toBe(1);
  });

  it('never decreases as Intensity grows', () => {
    const alphas = Array.from({ length: 101 }, (_, index) => getSurfaceAlpha(index / 10));
    expect(alphas.every((alpha, index) => index === 0 || alpha >= alphas[index - 1])).toBe(true);
  });
});

describe('getSurfacePixels', () => {
  it('paints each cell with its palette color, row 0 at the north edge', () => {
    const size = { width: grid.columns, height: grid.rows };
    const pixels = getSurfacePixels(grid, size);

    expect(pixels).toHaveLength(grid.columns * grid.rows * 4);
    expect(getPixel(pixels, size.width, 2, size.height - 1)).toEqual(getExpectedPixel(2));
    expect(getPixel(pixels, size.width, 1, size.height - 2)).toEqual(getExpectedPixel(2.7));
  });

  it('leaves missing cells transparent', () => {
    const pixels = getSurfacePixels(grid, { width: grid.columns, height: grid.rows });
    expect(getPixel(pixels, grid.columns, 2, 1)[3]).toBe(0);
  });

  it('samples rows by Web Mercator latitude so the surface lines up with the basemap', () => {
    const tall = getGrid({
      west: 0,
      east: 10,
      south: 0,
      north: 80,
      columns: 2,
      rows: 3,
      values: Float32Array.from([3, 3, 6, 6, 9, 9]),
    });
    const size = { width: 2, height: 100 };
    const pixels = getSurfacePixels(tall, size);

    expect(getPixel(pixels, 2, 0, 40)).toEqual(getExpectedPixel(9));
    expect(getPixel(pixels, 2, 0, 99)).toEqual(getExpectedPixel(3));
  });
});

describe('getContourPaths', () => {
  it('keeps each contour color and maps its vertices onto the canvas', () => {
    const size = { width: 100, height: 100 };
    const contours = getShakemapContours(shakemapContours);
    const paths = getContourPaths(grid, size, contours);

    expect(paths).toHaveLength(contours.length);
    expect(paths[0].color).toBe(contours[0].color);
    expect(paths[0].mmi).toBe(contours[0].mmi);
    expect(paths[0].lines[0][0]).toEqual(getCanvasPoint(grid, size, contours[0].lines[0][0]));
  });
});

describe('getRevealOutline', () => {
  it('traces a closed geodesic circle around the Epicenter', () => {
    const size = { width: 400, height: 400 };
    const epicenter = { latitude: 37, longitude: -3.5 };
    const outline = getRevealOutline(grid, size, epicenter, 50);
    const [centerX, centerY] = getCanvasPoint(grid, size, [
      epicenter.longitude,
      epicenter.latitude,
    ]);

    expect(outline).toHaveLength(128);
    expect(outline[0][0]).toBeCloseTo(centerX);
    expect(outline[0][1]).toBeLessThan(centerY);
    expect(outline[64][1]).toBeGreaterThan(centerY);
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
