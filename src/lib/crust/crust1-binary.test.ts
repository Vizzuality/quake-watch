import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  crustCellsInputSchema,
  getCrust1Cell,
  getCrust1CellIndex,
  getCrust1Cells,
} from './crust1-binary';

const bytes = readFileSync(path.resolve(import.meta.dirname, '../../../data/crust1.bin'));
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const REFERENCE_CELLS = [
  {
    name: 'central Pacific',
    latitude: 0.5,
    longitude: -150.5,
    bnds: [0.0, -4.29, -4.29, -4.71, -4.71, -4.71, -5.35, -6.76, -11.13],
  },
  {
    name: 'Madrid',
    latitude: 40.5,
    longitude: -3.5,
    bnds: [0.8, 0.8, 0.8, -0.2, -2.0, -2.0, -11.83, -21.65, -31.77],
  },
  {
    name: 'Tibet',
    latitude: 30.5,
    longitude: 90.5,
    bnds: [5.01, 5.01, 5.01, 4.91, 4.91, 4.91, -30.74, -47.86, -66.39],
  },
];

describe('data/crust1.bin', () => {
  it('holds 64800 cells of 9 Int16 values', () => {
    expect(bytes.byteLength).toBe(1_166_400);
  });
});

describe('getCrust1CellIndex', () => {
  it('maps the north-west and south-east corner cells to the first and last entries', () => {
    expect(getCrust1CellIndex(89.5, -179.5)).toBe(0);
    expect(getCrust1CellIndex(-89.5, 179.5)).toBe(64799);
  });

  it('maps any point of a cell to that cell', () => {
    expect(getCrust1CellIndex(40.01, -3.99)).toBe(getCrust1CellIndex(40.5, -3.5));
    expect(getCrust1CellIndex(40.99, -3.01)).toBe(getCrust1CellIndex(40.5, -3.5));
  });

  it('clamps the poles into the outermost rows', () => {
    expect(getCrust1CellIndex(90, 0.5)).toBe(getCrust1CellIndex(89.5, 0.5));
    expect(getCrust1CellIndex(-90, 0.5)).toBe(getCrust1CellIndex(-89.5, 0.5));
  });

  it('wraps longitude across the antimeridian', () => {
    expect(getCrust1CellIndex(10.5, 180)).toBe(getCrust1CellIndex(10.5, -180));
    expect(getCrust1CellIndex(10.5, -180)).toBe(getCrust1CellIndex(10.5, -179.5));
  });
});

describe('getCrust1Cell', () => {
  it.each(REFERENCE_CELLS)('matches crust1.bnds in $name', ({ latitude, longitude, bnds }) => {
    const cell = getCrust1Cell(view, latitude, longitude);
    expect(cell.latitude).toBe(latitude);
    expect(cell.longitude).toBe(longitude);
    expect(cell.boundaryElevationsKm).toHaveLength(9);
    bnds.forEach((expected, index) => {
      expect(cell.boundaryElevationsKm[index]).toBe(expected);
    });
  });

  it('returns the cell centre for an arbitrary point inside the cell', () => {
    const cell = getCrust1Cell(view, 40.9, -3.2);
    expect(cell.latitude).toBe(40.5);
    expect(cell.longitude).toBe(-3.5);
  });
});

describe('getCrust1Cells', () => {
  it('returns only the centre cell for radiusCells 0', () => {
    const cells = getCrust1Cells(view, { latitude: 40.4, longitude: -3.7, radiusCells: 0 });
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ latitude: 40.5, longitude: -3.5 });
  });

  it('returns (2r+1)^2 cells centred on the epicentre cell', () => {
    const cells = getCrust1Cells(view, { latitude: 40.5, longitude: -3.5, radiusCells: 2 });
    expect(cells).toHaveLength(25);
    expect(cells).toContainEqual(expect.objectContaining({ latitude: 42.5, longitude: -5.5 }));
    expect(cells).toContainEqual(expect.objectContaining({ latitude: 38.5, longitude: -1.5 }));
  });

  it('wraps cells across the antimeridian', () => {
    const cells = getCrust1Cells(view, { latitude: 10.5, longitude: 179.9, radiusCells: 1 });
    const longitudes = new Set(cells.map((cell) => cell.longitude));
    expect(longitudes).toEqual(new Set([178.5, 179.5, -179.5]));
    expect(cells).toHaveLength(9);
  });

  it('wraps cells west of the antimeridian', () => {
    const cells = getCrust1Cells(view, { latitude: 10.5, longitude: -179.9, radiusCells: 1 });
    expect(new Set(cells.map((cell) => cell.longitude))).toEqual(new Set([179.5, -179.5, -178.5]));
  });

  it('clamps at the poles without wrapping', () => {
    const cells = getCrust1Cells(view, { latitude: 89.9, longitude: 0.5, radiusCells: 2 });
    const latitudes = new Set(cells.map((cell) => cell.latitude));
    expect(Math.max(...latitudes)).toBe(89.5);
    expect(Math.min(...latitudes)).toBe(87.5);
    expect(cells).toHaveLength(15);
    expect(new Set(cells.map((cell) => `${cell.latitude},${cell.longitude}`)).size).toBe(15);
  });

  it('clamps at the south pole', () => {
    const cells = getCrust1Cells(view, { latitude: -89.9, longitude: 0.5, radiusCells: 1 });
    expect(Math.min(...cells.map((cell) => cell.latitude))).toBe(-89.5);
    expect(cells).toHaveLength(6);
  });
});

describe('crustCellsInputSchema', () => {
  const valid = { latitude: 40.4, longitude: -3.7, radiusCells: 3 };

  it('accepts valid input and the range bounds', () => {
    expect(crustCellsInputSchema.parse(valid)).toEqual(valid);
    expect(
      crustCellsInputSchema.safeParse({ latitude: -90, longitude: 180, radiusCells: 6 }).success,
    ).toBe(true);
    expect(
      crustCellsInputSchema.safeParse({ latitude: 90, longitude: -180, radiusCells: 0 }).success,
    ).toBe(true);
  });

  it.each([
    { ...valid, latitude: 90.1 },
    { ...valid, latitude: -90.1 },
    { ...valid, longitude: 180.1 },
    { ...valid, longitude: -180.1 },
    { ...valid, radiusCells: 7 },
    { ...valid, radiusCells: -1 },
    { ...valid, radiusCells: 1.5 },
    { ...valid, latitude: Number.NaN },
    { latitude: 1, longitude: 1 },
    { ...valid, latitude: '40.4' },
  ])('rejects %j', (input) => {
    expect(crustCellsInputSchema.safeParse(input).success).toBe(false);
  });
});
