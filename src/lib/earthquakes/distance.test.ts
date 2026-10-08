import { describe, expect, it } from 'vitest';

import { getDistanceKm } from './distance';

describe('getDistanceKm', () => {
  it('is zero for the same point', () => {
    expect(
      getDistanceKm({ latitude: 37.17, longitude: -3.6 }, { latitude: 37.17, longitude: -3.6 }),
    ).toBe(0);
  });

  it('measures Granada → Madrid at about 360 km', () => {
    expect(
      getDistanceKm(
        { latitude: 37.1773, longitude: -3.5986 },
        { latitude: 40.4168, longitude: -3.7038 },
      ),
    ).toBeCloseTo(360, -1);
  });
});
