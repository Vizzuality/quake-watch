import { describe, expect, it } from 'vitest';

import { shakemapCoverage } from '@/test/fixtures/shakemap-coverage';

import { EarthquakeSourceError } from '../earthquakes/query-options';
import {
  getGridLatitude,
  getGridLongitude,
  getGridMmi,
  getPaletteColor,
  getShakemapGrid,
} from './coverage';

const grid = getShakemapGrid(shakemapCoverage);

function getCoverageWith(overrides: {
  x?: object;
  y?: object;
  values?: unknown;
  extent?: unknown;
}) {
  const { axes } = shakemapCoverage.domain;
  return {
    ...shakemapCoverage,
    domain: { axes: { x: { ...axes.x, ...overrides.x }, y: { ...axes.y, ...overrides.y } } },
    parameters: {
      MMI: {
        preferredPalette: {
          ...shakemapCoverage.parameters.MMI.preferredPalette,
          ...(overrides.extent ? { extent: overrides.extent } : {}),
        },
      },
    },
    ranges: {
      MMI: {
        ...shakemapCoverage.ranges.MMI,
        ...(overrides.values ? { values: overrides.values } : {}),
      },
    },
  };
}

describe('getShakemapGrid', () => {
  it('maps the domain axes, shape and palette of the real coverage', () => {
    expect(grid).toMatchObject({ columns: 5, rows: 4, south: 35.25 });
    expect(grid.west).toBeCloseTo(-5.8333, 4);
    expect(grid.east).toBeCloseTo(-1.3256, 4);
    expect(grid.north).toBeCloseTo(38.8653, 4);
    expect(grid.palette.extent).toEqual([0, 10]);
    expect(grid.palette.colors).toHaveLength(11);
    expect(grid.values).toBeInstanceOf(Float32Array);
    expect(grid.values).toHaveLength(20);
  });

  it('turns null cells into NaN', () => {
    expect(Number.isNaN(grid.values[12])).toBe(true);
    expect(grid.values[0]).toBeCloseTo(1.7);
  });

  it('keeps the east edge past 180 when the x axis wraps the antimeridian', () => {
    const wrapped = getShakemapGrid(getCoverageWith({ x: { start: 179, stop: -179 } }));
    expect(wrapped.west).toBe(179);
    expect(wrapped.east).toBe(181);
  });

  it.each([
    ['null', null],
    ['a missing palette', { ...shakemapCoverage, parameters: {} }],
    ['a value count that does not match the shape', getCoverageWith({ values: [1, 2, 3] })],
    ['a y axis that descends', getCoverageWith({ y: { start: 40, stop: 35 } })],
    ['a single-column axis', getCoverageWith({ x: { num: 1 } })],
    ['an empty palette range', getCoverageWith({ extent: [5, 5] })],
    [
      'swapped axis names',
      {
        ...shakemapCoverage,
        ranges: { MMI: { ...shakemapCoverage.ranges.MMI, axisNames: ['x', 'y'] } },
      },
    ],
  ])('throws EarthquakeSourceError for %s', (_label, json) => {
    expect(() => getShakemapGrid(json)).toThrow(EarthquakeSourceError);
  });
});

describe('getGridMmi', () => {
  it('reads each corner of an asymmetric grid as y-major, south row first', () => {
    expect(getGridMmi(grid, grid.west, grid.south)).toBeCloseTo(1.7);
    expect(getGridMmi(grid, grid.east, grid.south)).toBeCloseTo(1.5);
    expect(getGridMmi(grid, grid.west, grid.north)).toBeCloseTo(1.4);
    expect(getGridMmi(grid, grid.east, grid.north)).toBeCloseTo(1.6);
  });

  it('reads an interior cell from its row and column', () => {
    const longitude = getGridLongitude(grid, 3);
    const latitude = getGridLatitude(grid, 1);
    expect(getGridMmi(grid, longitude, latitude)).toBeCloseTo(2.5);
    expect(getGridMmi(grid, getGridLongitude(grid, 2), latitude)).toBeCloseTo(3.2);
  });

  it('snaps to the nearest cell', () => {
    const longitude = getGridLongitude(grid, 2) + 0.2;
    const latitude = getGridLatitude(grid, 1) - 0.2;
    expect(getGridMmi(grid, longitude, latitude)).toBeCloseTo(3.2);
  });

  it('returns null outside the grid', () => {
    expect(getGridMmi(grid, grid.west - 0.01, grid.south + 1)).toBeNull();
    expect(getGridMmi(grid, grid.east + 0.01, grid.south + 1)).toBeNull();
    expect(getGridMmi(grid, grid.west + 1, grid.south - 0.01)).toBeNull();
    expect(getGridMmi(grid, grid.west + 1, grid.north + 0.01)).toBeNull();
  });

  it('returns null for non-finite coordinates', () => {
    expect(getGridMmi(grid, Number.NaN, grid.south + 1)).toBeNull();
    expect(getGridMmi(grid, grid.west + 1, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('returns null on a NaN cell', () => {
    expect(getGridMmi(grid, getGridLongitude(grid, 2), getGridLatitude(grid, 2))).toBeNull();
  });

  it('wraps the longitude across the antimeridian', () => {
    const wrapped = getShakemapGrid(getCoverageWith({ x: { start: 179, stop: -179 } }));
    const latitude = getGridLatitude(wrapped, 1);
    expect(getGridMmi(wrapped, 179, latitude)).toBeCloseTo(2.2);
    expect(getGridMmi(wrapped, -179, latitude)).toBeCloseTo(1.9);
    expect(getGridMmi(wrapped, -180, latitude)).toBeCloseTo(3.2);
    expect(getGridMmi(wrapped, 180, latitude)).toBeCloseTo(3.2);
    expect(getGridMmi(wrapped, -178, latitude)).toBeNull();
    expect(getGridMmi(wrapped, 178, latitude)).toBeNull();
  });

  it('matches a longitude expressed on the other side of the antimeridian', () => {
    const wrapped = getShakemapGrid(getCoverageWith({ x: { start: 170, stop: 190 } }));
    const latitude = getGridLatitude(wrapped, 0);
    expect(getGridMmi(wrapped, -175, latitude)).toBe(getGridMmi(wrapped, 185, latitude));
    expect(getGridMmi(wrapped, -175, latitude)).not.toBeNull();
  });
});

describe('getPaletteColor', () => {
  const { palette } = grid;

  it('returns the exact palette stop at an integer Intensity', () => {
    expect(getPaletteColor(palette, 2)).toEqual([191 / 255, 204 / 255, 1]);
    expect(getPaletteColor(palette, 9)).toEqual([1, 0, 0]);
  });

  it('interpolates linearly between stops', () => {
    const [red, green, blue] = getPaletteColor(palette, 2.5);
    expect(red).toBeCloseTo((191 + 160) / 2 / 255);
    expect(green).toBeCloseTo((204 + 230) / 2 / 255);
    expect(blue).toBeCloseTo(1);
  });

  it('clamps below and above the extent', () => {
    expect(getPaletteColor(palette, -3)).toEqual([1, 1, 1]);
    expect(getPaletteColor(palette, 14)).toEqual([200 / 255, 0, 0]);
  });
});
