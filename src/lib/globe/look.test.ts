import { describe, expect, it } from 'vitest';

import { GLOBE_DOT_COUNT, GLOBE_GLOW, GLOBE_LOOK, GLOBE_VEIL_RGB } from './look';

describe('globe look', () => {
  it('pins the board LK constants', () => {
    expect(GLOBE_DOT_COUNT).toBe(30_000);
    expect(GLOBE_VEIL_RGB).toEqual([24, 26, 54]);
    expect(GLOBE_LOOK).toEqual({
      ocean: [63, 127, 217],
      oceanA: 1,
      land: [124, 214, 178],
      landA: 0.25,
      landS: 0.9,
      dot: 0.7,
      rim: 1,
      outA: 0.15,
      outW: 0.5,
      veil: 0.7,
      backK: 0.75,
    });
    expect(GLOBE_GLOW).toEqual({ from: 0.92, to: 1.28, rgb: [90, 100, 255], alpha: 0.1 });
  });
});
