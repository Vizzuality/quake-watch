import { describe, expect, it } from 'vitest';

import { getLandMask } from './land-mask';
import { GLOBE_DOT_COUNT } from './look';
import { getFibonacciPoints, getLatLonVector } from './sphere';

const points = getFibonacciPoints(GLOBE_DOT_COUNT);

function getNearestPointIndex(lat: number, lon: number): number {
  const [x, y, z] = getLatLonVector(lat, lon);
  let best = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < GLOBE_DOT_COUNT; i++) {
    const dot = points[i * 3] * x + points[i * 3 + 1] * y + points[i * 3 + 2] * z;
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  }
  return best;
}

describe('getLandMask', () => {
  const mask = getLandMask();

  it('has one entry per globe dot', () => {
    expect(mask).toHaveLength(GLOBE_DOT_COUNT);
  });

  it.each([
    ['Sahara', 23, 13, 1],
    ['Amazon', -5, -62, 1],
    ['mid-Pacific', 0, -150, 0],
    ['mid-Atlantic', 30, -40, 0],
  ])('marks %s (%i, %i) as %i', (_, lat, lon, expected) => {
    expect(mask[getNearestPointIndex(lat, lon)]).toBe(expected);
  });
});
