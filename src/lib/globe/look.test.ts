import { describe, expect, it } from 'vitest';

import { GLOBE_DOT_COUNT, GLOBE_LOOK } from './look';

describe('globe look', () => {
  it('pins the look fitted to the Figma D1 globe', () => {
    expect(GLOBE_DOT_COUNT).toBe(30_000);
    expect(GLOBE_LOOK).toEqual({
      ocean: [96, 104, 200],
      oceanA: 0.27,
      land: [240, 208, 178],
      landA: 1,
      landS: 1.5,
      dot: 1.5,
      rim: 1.15,
    });
  });
});
