import { describe, expect, it } from 'vitest';

import { type LngLat, getFeltRing, getFeltRingBounds } from './map-felt-rings';
import { EARTH_RADIUS_KM } from './quakes';

function getDistanceKm([lon1, lat1]: LngLat, [lon2, lat2]: LngLat): number {
  const toRadians = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRadians;
  const dLon = (lon2 - lon1) * toRadians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function getLargestStep(ring: readonly LngLat[]): number {
  return Math.max(...ring.slice(1).map(([lon], index) => Math.abs(lon - ring[index][0])));
}

describe('getFeltRing', () => {
  it('puts every outline vertex at the felt reach from the epicentre', () => {
    const { outline, polygon, hasPole } = getFeltRing(-15.5, 167.2, 690);
    expect(hasPole).toBe(false);
    expect(polygon).toEqual([outline]);
    expect(outline.at(-1)).toEqual(outline[0]);
    for (const vertex of outline) {
      expect(Math.abs(getDistanceKm(vertex, [167.2, -15.5]) - 690) / 690).toBeLessThan(0.01);
    }
  });

  it('keeps longitudes continuous across the antimeridian', () => {
    const { outline } = getFeltRing(-17, 179.5, 300);
    expect(getLargestStep(outline)).toBeLessThan(10);
  });

  it('closes a ring around one pole through that pole', () => {
    const { outline, polygon, hasPole } = getFeltRing(52.5, 160.3, 5000);
    expect(hasPole).toBe(true);
    expect(getLargestStep(outline)).toBeLessThan(180);
    expect(Math.min(...outline.map(([lon]) => lon))).toBeGreaterThanOrEqual(-180);
    const lats = polygon[0].map(([, lat]) => lat);
    expect(Math.max(...lats)).toBeCloseTo(85.051129, 5);
    expect(Math.min(...lats)).toBeGreaterThan(0);
  });

  it('closes a ring around the south pole through the south pole', () => {
    const { polygon } = getFeltRing(-70, 10, 3000);
    expect(Math.min(...polygon[0].map(([, lat]) => lat))).toBeCloseTo(-85.051129, 5);
  });

  it('cuts the unfelt cap out of the world when the ring holds both poles', () => {
    const { outline, polygon, hasPole } = getFeltRing(10, 160.3, 13_900);
    expect(hasPole).toBe(true);
    expect(polygon).toHaveLength(2);
    expect(polygon[1]).toBe(outline);
    const antipode: LngLat = [160.3 + 180, -10];
    for (const vertex of outline) {
      expect(getDistanceKm(vertex, antipode)).toBeCloseTo(Math.PI * EARTH_RADIUS_KM - 13_900, -1);
    }
  });
});

describe('getFeltRingBounds', () => {
  it('returns the south-west and north-east corners of the ring', () => {
    const [[west, south], [east, north]] = getFeltRingBounds(getFeltRing(0, 0, 111.195).outline);
    expect(west).toBeCloseTo(-1, 3);
    expect(east).toBeCloseTo(1, 3);
    expect(south).toBeCloseTo(-1, 3);
    expect(north).toBeCloseTo(1, 3);
  });
});
