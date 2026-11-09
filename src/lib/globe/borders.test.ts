import { describe, expect, it } from 'vitest';

import { getBorderSegments } from './borders';
import { getPointLatLon } from './sphere';

const SEGMENT_STRIDE = 6;
const XYZ_STRIDE = 3;

describe('getBorderSegments', () => {
  const segments = getBorderSegments();
  const endpoints = Array.from({ length: segments.length / SEGMENT_STRIDE }, (_, index) => {
    const offset = index * SEGMENT_STRIDE;
    return [
      getPointLatLon(segments[offset], segments[offset + 1], segments[offset + 2]),
      getPointLatLon(segments[offset + 3], segments[offset + 4], segments[offset + 5]),
    ];
  });

  it('decodes 7,647 segments as xyz pairs', () => {
    expect(segments.length % SEGMENT_STRIDE).toBe(0);
    expect(segments.length / SEGMENT_STRIDE).toBe(7647);
  });

  it('places every vertex on the unit sphere', () => {
    let worst = 0;
    for (let i = 0; i < segments.length; i += XYZ_STRIDE)
      worst = Math.max(
        worst,
        Math.abs(Math.hypot(segments[i], segments[i + 1], segments[i + 2]) - 1),
      );
    expect(worst).toBeLessThan(1e-3);
  });

  it('drops the antimeridian and south-pole cut edges', () => {
    const cuts = endpoints.filter(
      ([start, end]) =>
        (Math.abs(Math.abs(start.lon) - 180) < 1e-3 && Math.abs(Math.abs(end.lon) - 180) < 1e-3) ||
        (start.lat < -89.999 && end.lat < -89.999),
    );
    expect(cuts).toHaveLength(0);
  });

  it('draws each shared border once', () => {
    const keys = new Set<string>();
    for (let i = 0; i < segments.length; i += SEGMENT_STRIDE) {
      const start = Array.from(segments.subarray(i, i + XYZ_STRIDE), (value) => value.toFixed(5));
      const end = Array.from(segments.subarray(i + XYZ_STRIDE, i + SEGMENT_STRIDE), (value) =>
        value.toFixed(5),
      );
      keys.add([start.join(','), end.join(',')].sort().join(';'));
    }
    expect(keys.size).toBe(segments.length / SEGMENT_STRIDE);
  });
});
