import { describe, expect, it } from 'vitest';

import { getRoundedCoordinate } from './coordinates';

describe('getRoundedCoordinate', () => {
  it('rounds to the given digits', () => {
    expect(getRoundedCoordinate(37.177345, 2)).toBe(37.18);
    expect(getRoundedCoordinate(-3.598612, 4)).toBe(-3.5986);
  });
});
