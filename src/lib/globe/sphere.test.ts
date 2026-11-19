import { describe, expect, it, vi } from 'vitest';

import {
  getCoastSegments,
  getFibonacciPoints,
  getLatLonVector,
  getPointLatLon,
  getRetried,
  getRotatedVector,
} from './sphere';

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

  it('rotates the view centre to z = 1 like the shader getRotated', () => {
    const lon = (150 * Math.PI) / 180;
    const lat = 0.12;
    const centre = getLatLonVector((lat * 180) / Math.PI, 150);
    [0, 0, 1].forEach((value, index) =>
      expect(getRotatedVector(centre, lon, lat)[index]).toBeCloseTo(value, 10),
    );
  });

  it('matches the shader rotation sign for sign', () => {
    const lon = 0.7;
    const lat = -0.3;
    const [x, y, z] = [0.2, 0.5, -0.4];
    const x1 = x * Math.cos(lon) - z * Math.sin(lon);
    const z1 = x * Math.sin(lon) + z * Math.cos(lon);
    const expected = [
      x1,
      y * Math.cos(lat) - z1 * Math.sin(lat),
      y * Math.sin(lat) + z1 * Math.cos(lat),
    ];
    expected.forEach((value, index) =>
      expect(getRotatedVector([x, y, z], lon, lat)[index]).toBeCloseTo(value, 12),
    );
  });
});

describe('getCoastSegments', () => {
  it('splits tenth-of-a-degree polylines into segments, each vertex knowing its other end', () => {
    const { position, other } = getCoastSegments([
      [0, 0, 900, 0, 900, 450],
      [-1800, 0, -1790, 0],
    ]);
    const vertices = [
      [0, 0],
      [0, 90],
      [0, 90],
      [45, 90],
      [0, -180],
      [0, -179],
    ];
    const partners = [1, 0, 3, 2, 5, 4];

    expect(position).toHaveLength(18);
    vertices.forEach(([lat, lon], vertex) => {
      const expected = getLatLonVector(lat, lon);
      const partner = vertices[partners[vertex]];
      const expectedOther = getLatLonVector(partner[0], partner[1]);
      for (let axis = 0; axis < 3; axis++) {
        expect(position[vertex * 3 + axis]).toBeCloseTo(expected[axis], 6);
        expect(other[vertex * 3 + axis]).toBeCloseTo(expectedOther[axis], 6);
      }
    });
  });
});

describe('getRetried', () => {
  it('retries a failed load once', async () => {
    const load = vi.fn<() => Promise<string>>();
    load.mockRejectedValueOnce(new Error('chunk')).mockResolvedValueOnce('land');

    await expect(getRetried(load)).resolves.toBe('land');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('gives up after the second failure', async () => {
    const load = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('chunk'));

    await expect(getRetried(load)).rejects.toThrow('chunk');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
