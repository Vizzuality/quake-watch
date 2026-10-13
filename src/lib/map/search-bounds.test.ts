import { describe, expect, it } from 'vitest';

import { getSearchBounds } from './search-bounds';

describe('getSearchBounds', () => {
  it('spans the radius around Granada', () => {
    const [[w, s], [e, n]] = getSearchBounds({ latitude: 37.18, longitude: -3.6 }, 100);
    expect(n - s).toBeCloseTo((2 * 100) / 111.195, 3);
    expect(e - w).toBeCloseTo((2 * 100) / (111.195 * Math.cos((37.18 * Math.PI) / 180)), 3);
  });

  it('widens longitude at high latitude without inverting', () => {
    const [[w, s], [e, n]] = getSearchBounds({ latitude: 64, longitude: -21.9 }, 500);
    expect(e).toBeGreaterThan(w);
    expect(n).toBeGreaterThan(s);
    expect(n).toBeLessThanOrEqual(85);
  });

  it('keeps longitudes continuous across the antimeridian', () => {
    const [[w], [e]] = getSearchBounds({ latitude: -17.7, longitude: 178 }, 500);
    expect(w).toBeLessThan(178);
    expect(e).toBeGreaterThan(180);
  });

  it('clamps latitudes and stays ordered near the pole', () => {
    const [[w, s], [e, n]] = getSearchBounds({ latitude: 84, longitude: 0 }, 500);
    expect(s).toBeLessThan(n);
    expect(n).toBeLessThanOrEqual(85);
    expect(w).toBeLessThan(e);
  });

  it('caps the longitude span at 180 degrees per side at the pole', () => {
    const [[w, s], [e, n]] = getSearchBounds({ latitude: 90, longitude: 0 }, 500);
    expect(e - w).toBe(360);
    expect(s).toBeLessThanOrEqual(n);
  });

  it.each([90, -90])('keeps both latitudes ordered and within ±85 at latitude %d', (latitude) => {
    const [[, s], [, n]] = getSearchBounds({ latitude, longitude: 0 }, 500);
    expect(s).toBeLessThanOrEqual(n);
    for (const value of [s, n]) {
      expect(value).toBeGreaterThanOrEqual(-85);
      expect(value).toBeLessThanOrEqual(85);
    }
  });

  it('stays ordered when the centre sits just beyond the latitude clamp', () => {
    const [[, s], [, n]] = getSearchBounds({ latitude: 86, longitude: 0 }, 50);
    expect(s).toBeLessThanOrEqual(n);
  });
});
