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

function hasLandDotWithin(mask: Uint8Array, lat: number, lon: number, degrees: number): boolean {
  const [x, y, z] = getLatLonVector(lat, lon);
  const minDot = Math.cos((degrees * Math.PI) / 180);
  for (let i = 0; i < GLOBE_DOT_COUNT; i++) {
    const dot = points[i * 3] * x + points[i * 3 + 1] * y + points[i * 3 + 2] * z;
    if (mask[i] === 1 && dot >= minDot) return true;
  }
  return false;
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

  it.each([
    ['Mallorca', 39.6, 2.95],
    ['Menorca', 39.95, 4.1],
    ['Ibiza', 38.98, 1.43],
    ['Tenerife', 28.27, -16.6],
    ['Gran Canaria', 27.95, -15.6],
    ['Lanzarote', 29.03, -13.63],
    ['São Miguel', 37.78, -25.5],
    ['Pico', 38.46, -28.33],
    ['Flores', 39.45, -31.2],
    ['Hawaiʻi', 19.6, -155.5],
    ['Oʻahu', 21.45, -158],
    ['Kauaʻi', 22.05, -159.5],
    ['Viti Levu', -17.8, 178],
    ['Vanua Levu', -16.6, 179.2],
    ['Sado', 38.05, 138.4],
    ['Okinawa', 26.5, 127.95],
    ['Tanegashima', 30.6, 131],
  ])('gives %s (%f, %f) a land dot within 1°', (_, lat, lon) => {
    expect(hasLandDotWithin(mask, lat, lon, 1)).toBe(true);
  });
});
