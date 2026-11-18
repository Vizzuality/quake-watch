import { describe, expect, it } from 'vitest';

import {
  CRUST_CELL_COUNT,
  type CrustColumn,
  getCrustColumn,
  getCrustLayersBuffer,
  getDecodedCrustLayers,
} from './crust-layers';

const VANUATU: CrustColumn = { sedimentsKm: 1.2, upperKm: 6.4, middleKm: 7, lowerKm: 9.8 };

function getColumns(): CrustColumn[] {
  return Array.from({ length: CRUST_CELL_COUNT }, () => ({
    sedimentsKm: 0,
    upperKm: 10,
    middleKm: 10,
    lowerKm: 10,
  }));
}

function getCellIndex(lat: number, lon: number): number {
  return (89.5 - lat) * 360 + (lon + 179.5);
}

describe('crust layers codec', () => {
  it('round-trips layer thicknesses at 0.2 km resolution', () => {
    const columns = getColumns();
    columns[getCellIndex(-15.5, 166.5)] = VANUATU;

    const grid = getDecodedCrustLayers(getCrustLayersBuffer(columns));

    expect(getCrustColumn(grid, -15.5, 166.5)).toEqual({
      sedimentsKm: 1.2,
      upperKm: 6.4,
      middleKm: 7,
      lowerKm: 9.8,
    });
  });

  it('reads the 1° cell that contains the point, as the model defines', () => {
    const columns = getColumns();
    columns[getCellIndex(-15.5, 166.5)] = VANUATU;
    const grid = getDecodedCrustLayers(getCrustLayersBuffer(columns));

    expect(getCrustColumn(grid, -15.01, 166.99).upperKm).toBe(6.4);
    expect(getCrustColumn(grid, -15.99, 166.01).upperKm).toBe(6.4);
    expect(getCrustColumn(grid, -14.99, 166.5).upperKm).toBe(10);
  });

  it('wraps longitudes across the antimeridian and clamps the poles', () => {
    const columns = getColumns();
    columns[getCellIndex(0.5, -179.5)] = VANUATU;
    columns[getCellIndex(-89.5, 179.5)] = VANUATU;
    const grid = getDecodedCrustLayers(getCrustLayersBuffer(columns));

    expect(getCrustColumn(grid, 0.5, 180.5)).toEqual(VANUATU);
    expect(getCrustColumn(grid, -90, 179.9)).toEqual(VANUATU);
  });

  it('caps a layer at the largest thickness one byte holds', () => {
    const columns = getColumns();
    columns[0] = { sedimentsKm: 80, upperKm: 0, middleKm: 0, lowerKm: 0 };

    const grid = getDecodedCrustLayers(getCrustLayersBuffer(columns));

    expect(getCrustColumn(grid, 89.5, -179.5).sedimentsKm).toBe(51);
  });

  it('rejects a buffer that is not a CRUST1.0 layer file', () => {
    expect(() => getDecodedCrustLayers(new Uint8Array(16))).toThrow('CRUST1.0');
  });
});
