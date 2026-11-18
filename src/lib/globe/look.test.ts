import { describe, expect, it } from 'vitest';

import { GLOBE_DOT_COUNT, GLOBE_LOOK, getCoastAlpha } from './look';

describe('globe look', () => {
  it('pins the prototype look', () => {
    expect(GLOBE_DOT_COUNT).toBe(30_000);
    expect(GLOBE_LOOK).toEqual({
      ocean: [63, 127, 217],
      oceanA: 1,
      land: [124, 214, 178],
      landA: 0.25,
      landS: 0.9,
      dot: 0.7,
      rim: 1,
      backFace: 0.18,
      veil: [24, 26, 54],
      veilA: 0.7,
      halo: [90, 100, 255],
      haloA: 0.1,
      haloFrom: 0.92,
      haloTo: 1.28,
      coastA: 0.15,
      coastPx: 0.5,
    });
  });

  it('spreads the 0.5 px coastline over the 1 device px WebGL line', () => {
    expect(getCoastAlpha(2)).toBe(0.15);
    expect(getCoastAlpha(1)).toBe(0.075);
    expect(getCoastAlpha(3)).toBe(0.15);
  });
});
