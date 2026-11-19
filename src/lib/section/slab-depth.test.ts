import { describe, expect, it } from 'vitest';

import {
  type SlabGrid,
  getDecodedSlabGrids,
  getSlabDepthKm,
  getSlabGridsBuffer,
} from './slab-depth';

const NONE = Number.NaN;

const VANUATU: SlabGrid = {
  west: 166,
  south: -16,
  step: 0.2,
  columns: 3,
  rows: 2,
  depthsKm: [10, 20, NONE, 30, 40, 50],
};

describe('slab depth codec', () => {
  it('round-trips regions and their missing cells at 0.1 km resolution', () => {
    const [grid] = getDecodedSlabGrids(getSlabGridsBuffer([VANUATU]));

    expect(grid.west).toBeCloseTo(166);
    expect(grid.south).toBeCloseTo(-16);
    expect(grid.step).toBeCloseTo(0.2);
    expect(grid.columns).toBe(3);
    expect(grid.rows).toBe(2);
    expect(Array.from(grid.depthsKm).slice(0, 2)).toEqual([10, 20]);
    expect(grid.depthsKm[2]).toBeNaN();
  });

  it('interpolates the top of the plate between four mapped cells', () => {
    const grids = getDecodedSlabGrids(getSlabGridsBuffer([VANUATU]));

    expect(getSlabDepthKm(grids, -15.9, 166.1)).toBeCloseTo(25);
    expect(getSlabDepthKm(grids, -16, 166)).toBeCloseTo(10);
  });

  it('averages the mapped cells at the edge of the plate, weighted by distance', () => {
    const grids = getDecodedSlabGrids(getSlabGridsBuffer([VANUATU]));

    expect(getSlabDepthKm(grids, -15.9, 166.3)).toBeCloseTo((20 + 40 + 50) / 3);
  });

  it('has no plate nearer an unmapped cell than a mapped one, or outside every region', () => {
    const grids = getDecodedSlabGrids(getSlabGridsBuffer([VANUATU]));

    expect(getSlabDepthKm(grids, -15.98, 166.38)).toBeNull();
    expect(getSlabDepthKm(grids, 10, 10)).toBeNull();
  });

  it('matches regions stored in 0–360° longitude from −180–180° input', () => {
    const aleutians: SlabGrid = { ...VANUATU, west: 186, south: 51 };
    const grids = getDecodedSlabGrids(getSlabGridsBuffer([aleutians]));

    expect(getSlabDepthKm(grids, 51.1, -173.9)).toBeCloseTo(25);
  });

  it('rejects a buffer that is not a slab file', () => {
    expect(() => getDecodedSlabGrids(new Uint8Array(16))).toThrow('Slab2');
  });
});
