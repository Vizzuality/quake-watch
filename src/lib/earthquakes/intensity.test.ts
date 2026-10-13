import { describe, expect, it } from 'vitest';

import {
  FELT_INTENSITY,
  getFeltReachKm,
  getIntensity,
  getIntensityLevel,
} from '@/lib/earthquakes/intensity';

// https://raw.githubusercontent.com/gem/oq-engine/v3.26.2/openquake/hazardlib/tests/gsim/data/a12ipe/AWW_IPE_RHYPO_MEAN.csv
const OPENQUAKE_ROWS: ReadonlyArray<readonly [number, number, number]> = [
  [5, 1, 8.1928149],
  [5, 10, 5.9736099],
  [5, 50, 3.7394023],
  [5, 100, 2.8223814],
  [5, 300, 1.368028],
  [6, 5, 7.8627966],
  [6, 20, 6.4046804],
  [6, 50, 5.1603881],
  [6, 100, 4.2486195],
  [6, 300, 2.795832],
  [7, 1, 8.2924672],
  [7, 50, 6.5368604],
  [7, 100, 5.6632662],
  [7, 300, 4.2223319],
];

describe('getIntensity', () => {
  it.each(OPENQUAKE_ROWS)('M%d at rhypo %d km gives MMI %d', (magnitude, rhypo, expected) => {
    expect(getIntensity({ magnitude, depthKm: 0, distanceKm: rhypo })).toBeCloseTo(expected, 2);
  });

  it('combines epicentral distance and depth into hypocentral distance', () => {
    const expected = getIntensity({ magnitude: 5, depthKm: 0, distanceKm: 50 });
    expect(getIntensity({ magnitude: 5, depthKm: 30, distanceKm: 40 })).toBeCloseTo(expected, 10);
  });

  it('is lower for a deeper earthquake at the same distance', () => {
    const shallow = getIntensity({ magnitude: 5, depthKm: 5, distanceKm: 20 });
    const deep = getIntensity({ magnitude: 5, depthKm: 50, distanceKm: 20 });
    expect(deep).toBeLessThan(shallow);
  });
});

describe('getFeltReachKm', () => {
  it('grows with magnitude', () => {
    const [m2, m4, m6] = [2, 4, 6].map((magnitude) => getFeltReachKm({ magnitude, depthKm: 10 }));
    expect(m2).toBeLessThan(m4);
    expect(m4).toBeLessThan(m6);
  });

  it.each([3, 5, 7])('lands on intensity II for M%d', (magnitude) => {
    const reach = getFeltReachKm({ magnitude, depthKm: 10 });
    expect(reach).toBeGreaterThan(0);
    expect(getIntensity({ magnitude, depthKm: 10, distanceKm: reach })).toBeCloseTo(
      FELT_INTENSITY,
      2,
    );
  });

  it('is 0 for a small deep earthquake', () => {
    expect(getFeltReachKm({ magnitude: 1, depthKm: 30 })).toBe(0);
  });

  it('shrinks with depth', () => {
    expect(getFeltReachKm({ magnitude: 4, depthKm: 30 })).toBeLessThan(
      getFeltReachKm({ magnitude: 4, depthKm: 5 }),
    );
  });

  it('is 0 for a missing magnitude or depth', () => {
    expect(getFeltReachKm({ magnitude: Number.NaN, depthKm: 10 })).toBe(0);
    expect(getFeltReachKm({ magnitude: 5, depthKm: Number.NaN })).toBe(0);
  });
});

describe('getIntensityLevel', () => {
  it.each([
    [1.4, 'I', 'not_felt'],
    [0, 'I', 'not_felt'],
    [1.5, 'II', 'weak'],
    [2.4, 'II', 'weak'],
    [3, 'III', 'weak'],
    [4, 'IV', 'light'],
    [4.5, 'V', 'moderate'],
    [6, 'VI', 'strong'],
    [7, 'VII', 'very_strong'],
    [8, 'VIII', 'severe'],
    [9, 'IX', 'violent'],
    [10, 'X', 'extreme'],
    [11, 'X', 'extreme'],
  ] as const)('maps %d to %s (%s)', (intensity, roman, key) => {
    expect(getIntensityLevel(intensity)).toEqual({ roman, key });
  });

  it('treats a missing intensity as not felt', () => {
    expect(getIntensityLevel(Number.NaN)).toEqual({ roman: 'I', key: 'not_felt' });
  });
});
