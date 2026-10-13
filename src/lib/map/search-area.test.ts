import { describe, expect, it } from 'vitest';

import { getDistanceKm } from '@/lib/earthquakes/distance';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';

import { getSearchAreaGeoJson } from './search-area';

function getAreaRing(center: SearchCenter, radiusKm: number, steps?: number) {
  const area = getSearchAreaGeoJson(center, radiusKm, steps).features.find(
    (feature) => feature.properties.kind === 'area',
  );
  if (area?.geometry.type !== 'Polygon') throw new Error('area polygon missing');
  return area.geometry.coordinates[0];
}

describe('getSearchAreaGeoJson', () => {
  const granada = { latitude: 37.18, longitude: -3.6 };

  it('closes the ring with steps + 1 positions', () => {
    const ring = getAreaRing(granada, 100, 64);
    expect(ring).toHaveLength(65);
    expect(ring[0]).toEqual(ring[64]);
  });

  it('defaults to 64 steps', () => {
    expect(getAreaRing(granada, 100)).toHaveLength(65);
  });

  it.each([
    ['Granada', granada, 100],
    ['Reykjavik', { latitude: 64, longitude: -21.9 }, 500],
  ])('places every vertex at the radius from %s', (_name, center, radiusKm) => {
    for (const [longitude, latitude] of getAreaRing(center, radiusKm)) {
      const distance = getDistanceKm(center, { latitude, longitude });
      expect(Math.abs(distance - radiusKm) / radiusKm).toBeLessThan(0.005);
    }
  });

  it('keeps longitudes continuous across the antimeridian', () => {
    for (const [longitude] of getAreaRing({ latitude: -17.7, longitude: 178 }, 500)) {
      expect(longitude).toBeGreaterThanOrEqual(168);
      expect(longitude).toBeLessThanOrEqual(188);
    }
  });

  it('adds the place point at the centre', () => {
    const place = getSearchAreaGeoJson(granada, 100).features.find(
      (feature) => feature.properties.kind === 'place',
    );
    expect(place?.geometry).toEqual({ type: 'Point', coordinates: [-3.6, 37.18] });
  });
});
