import { describe, expect, it } from 'vitest';

import {
  getBlockDepthKm,
  getBlockRadiusCells,
  getBlockSideKm,
  getCrustLayers,
  getDeepBoundariesKm,
  getMohoDepthKm,
  getRuptureStartDepthKm,
  MIN_BLOCK_DEPTH_KM,
  PREM_BOUNDARIES_KM,
  RELIEF_EXAGGERATION,
} from './block';
import type { CrustCell } from './types';

function getCell(
  latitude: number,
  longitude: number,
  boundaryElevationsKm: readonly number[],
): CrustCell {
  return { latitude, longitude, boundaryElevationsKm };
}

const MADRID_CELL = getCell(40.5, -3.5, [0.8, 0.8, 0.8, -0.2, -2.0, -2.0, -11.83, -21.65, -31.77]);
const TIBET_CELL = getCell(
  30.5,
  90.5,
  [5.01, 5.01, 5.01, 4.91, 4.91, 4.91, -30.74, -47.86, -66.39],
);
const PACIFIC_CELL = getCell(
  0.5,
  -150.5,
  [0.0, -4.29, -4.29, -4.71, -4.71, -4.71, -5.35, -6.76, -11.13],
);

describe('getCrustLayers', () => {
  it('converts elevations to depths and omits zero-thickness layers on land', () => {
    expect(getCrustLayers(MADRID_CELL)).toEqual([
      { kind: 'upper-sediments', topKm: -0.8, bottomKm: 0.2 },
      { kind: 'middle-sediments', topKm: 0.2, bottomKm: 2 },
      { kind: 'upper-crust', topKm: 2, bottomKm: 11.83 },
      { kind: 'middle-crust', topKm: 11.83, bottomKm: 21.65 },
      { kind: 'lower-crust', topKm: 21.65, bottomKm: 31.77 },
    ]);
  });

  it('puts the water layer first in the ocean and drops empty ice and sediment layers', () => {
    const layers = getCrustLayers(PACIFIC_CELL);
    expect(layers).toEqual([
      { kind: 'water', topKm: 0, bottomKm: 4.29 },
      { kind: 'upper-sediments', topKm: 4.29, bottomKm: 4.71 },
      { kind: 'upper-crust', topKm: 4.71, bottomKm: 5.35 },
      { kind: 'middle-crust', topKm: 5.35, bottomKm: 6.76 },
      { kind: 'lower-crust', topKm: 6.76, bottomKm: 11.13 },
    ]);
  });

  it('never returns a negative-zero sea surface', () => {
    const [water] = getCrustLayers(
      getCell(0.5, -150.5, [-0, ...PACIFIC_CELL.boundaryElevationsKm.slice(1)]),
    );
    expect(Object.is(water?.topKm, -0)).toBe(false);
  });

  it('gives a negative top depth for high relief', () => {
    const [first] = getCrustLayers(TIBET_CELL);
    expect(first).toEqual({ kind: 'upper-sediments', topKm: -5.01, bottomKm: -4.91 });
    expect(getCrustLayers(TIBET_CELL).map((layer) => layer.kind)).toEqual([
      'upper-sediments',
      'upper-crust',
      'middle-crust',
      'lower-crust',
    ]);
  });

  it('keeps layers contiguous', () => {
    [MADRID_CELL, TIBET_CELL, PACIFIC_CELL].forEach((cell) => {
      const layers = getCrustLayers(cell);
      layers.slice(1).forEach((layer, index) => {
        expect(layer.topKm).toBe(layers[index]?.bottomKm);
      });
    });
  });
});

describe('getMohoDepthKm', () => {
  it('returns the bottom of the lower crust as positive depth', () => {
    expect(getMohoDepthKm(MADRID_CELL)).toBe(31.77);
    expect(getMohoDepthKm(TIBET_CELL)).toBe(66.39);
    expect(getMohoDepthKm(PACIFIC_CELL)).toBe(11.13);
  });
});

describe('getBlockDepthKm', () => {
  it('never goes below the minimum depth', () => {
    expect(getBlockDepthKm(10, getMohoDepthKm(PACIFIC_CELL))).toBe(MIN_BLOCK_DEPTH_KM);
  });

  it('extends 20 km below a deep Moho', () => {
    expect(getBlockDepthKm(10, getMohoDepthKm(TIBET_CELL))).toBeCloseTo(86.39);
  });

  it('scales with hypocentre depth', () => {
    expect(getBlockDepthKm(700, 31.77)).toBeCloseTo(980);
  });

  it('treats zero and negative depths as surface events', () => {
    expect(getBlockDepthKm(0, 31.77)).toBe(MIN_BLOCK_DEPTH_KM);
    expect(getBlockDepthKm(-1, 31.77)).toBe(MIN_BLOCK_DEPTH_KM);
    expect(getBlockDepthKm(-1, 50)).toBe(70);
  });
});

describe('getRuptureStartDepthKm', () => {
  it('keeps in-range depths', () => {
    expect(getRuptureStartDepthKm(12, 60)).toBe(12);
  });

  it('clamps the marker to the block for depth 0, -1 and 700', () => {
    expect(getRuptureStartDepthKm(0, getBlockDepthKm(0, 31.77))).toBe(0);
    expect(getRuptureStartDepthKm(-1, getBlockDepthKm(-1, 31.77))).toBe(0);
    const deepBlock = getBlockDepthKm(700, 31.77);
    expect(getRuptureStartDepthKm(700, deepBlock)).toBe(700);
    expect(getRuptureStartDepthKm(700, 600)).toBe(600);
  });
});

describe('getDeepBoundariesKm', () => {
  it('uses the PREM discontinuities', () => {
    expect(PREM_BOUNDARIES_KM).toEqual({ transitionZoneTop: 400, lowerMantleTop: 670 });
  });

  it('returns none for a shallow block', () => {
    expect(getDeepBoundariesKm(60)).toEqual([]);
  });

  it('excludes a boundary at exactly the block depth', () => {
    expect(getDeepBoundariesKm(400)).toEqual([]);
  });

  it('returns only the transition zone between 400 and 670 km', () => {
    expect(getDeepBoundariesKm(500)).toEqual([{ kind: 'transition-zone-top', depthKm: 400 }]);
  });

  it('returns both for a deep-focus block', () => {
    expect(getDeepBoundariesKm(getBlockDepthKm(700, 31.77))).toEqual([
      { kind: 'transition-zone-top', depthKm: 400 },
      { kind: 'lower-mantle-top', depthKm: 670 },
    ]);
  });
});

describe('getBlockSideKm', () => {
  it('matches the block depth', () => {
    expect(getBlockSideKm(60)).toBe(60);
    expect(getBlockSideKm(980)).toBe(980);
  });
});

describe('getBlockRadiusCells', () => {
  it('needs no cells for an empty block', () => {
    expect(getBlockRadiusCells(0, 0)).toBe(0);
  });

  it('needs one cell each side for a small block at the equator', () => {
    expect(getBlockRadiusCells(60, 0)).toBe(1);
  });

  it('needs more longitude cells at high latitude', () => {
    expect(getBlockRadiusCells(200, 0)).toBe(1);
    expect(getBlockRadiusCells(200, 75)).toBe(4);
    expect(getBlockRadiusCells(200, -75)).toBe(4);
  });

  it('clamps to 6 cells', () => {
    expect(getBlockRadiusCells(980, 75)).toBe(6);
    expect(getBlockRadiusCells(200, 90)).toBe(6);
  });
});

describe('RELIEF_EXAGGERATION', () => {
  it('is 10x', () => {
    expect(RELIEF_EXAGGERATION).toBe(10);
  });
});
