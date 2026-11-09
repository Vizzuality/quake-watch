import { describe, expect, it } from 'vitest';

import { getFibonacciPoints, getLatLonVector, getPointLatLon } from './sphere';

describe('sphere', () => {
  it('builds unit Fibonacci points with the board formula', () => {
    const points = getFibonacciPoints(4);
    expect(points).toHaveLength(12);
    expect(points[1]).toBeCloseTo(0.75);
    expect(points[0]).toBeCloseTo(Math.sqrt(1 - 0.75 ** 2));
    expect(points[2]).toBeCloseTo(0);
    const theta = Math.PI * (3 - Math.sqrt(5));
    const r = Math.sqrt(1 - 0.25 ** 2);
    expect(points[3]).toBeCloseTo(Math.cos(theta) * r, 6);
    expect(points[4]).toBeCloseTo(0.25, 6);
    expect(points[5]).toBeCloseTo(Math.sin(theta) * r, 6);
    for (let i = 0; i < 4; i++)
      expect(Math.hypot(points[i * 3], points[i * 3 + 1], points[i * 3 + 2])).toBeCloseTo(1, 6);
  });

  it('round-trips lat/lon through the board convention', () => {
    const [x, y, z] = getLatLonVector(23, 13);
    const { lat, lon } = getPointLatLon(x, y, z);
    expect(lat).toBeCloseTo(23, 10);
    expect(lon).toBeCloseTo(13, 10);
    expect(getLatLonVector(0, 0)).toEqual([0, 0, 1]);
  });

  it('pins handedness: lon 90° is +x, lat 90° is +y', () => {
    const east = getLatLonVector(0, 90);
    const north = getLatLonVector(90, 0);
    [1, 0, 0].forEach((value, index) => expect(east[index]).toBeCloseTo(value, 10));
    [0, 1, 0].forEach((value, index) => expect(north[index]).toBeCloseTo(value, 10));
  });
});
