import { describe, expect, it } from 'vitest';

import { getDistanceKm } from '../earthquakes/search-area';
import { EARTH_RADIUS_KM } from './quakes';
import { getSearchAreaAngle, getSearchAreaFeatures } from './search-area-ring';

const GRANADA = { latitude: 37.18, longitude: -3.6, radiusKm: 50 } as const;

describe('getSearchAreaAngle', () => {
  it('turns the radius into the angle it spans at the centre of the Earth', () => {
    expect(getSearchAreaAngle({ ...GRANADA, radiusKm: 500 })).toBeCloseTo(500 / EARTH_RADIUS_KM);
  });
});

describe('getSearchAreaFeatures', () => {
  it('draws nothing without a search area', () => {
    expect(getSearchAreaFeatures(null)).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('draws a closed outline at the radius around the centre, and the centre itself', () => {
    const [outline, centre] = getSearchAreaFeatures(GRANADA).features;
    if (outline.geometry.type !== 'LineString') throw new Error('Outline is not a line');
    const coordinates = outline.geometry.coordinates;
    expect(coordinates.at(-1)).toEqual(coordinates[0]);
    for (const [longitude, latitude] of coordinates) {
      expect(getDistanceKm(GRANADA, { latitude, longitude })).toBeCloseTo(50, 6);
    }
    expect(centre.geometry).toEqual({ type: 'Point', coordinates: [-3.6, 37.18] });
  });

  it('keeps the outline continuous across the antimeridian', () => {
    const [outline] = getSearchAreaFeatures({
      latitude: -17,
      longitude: 179.9,
      radiusKm: 500,
    }).features;
    if (outline.geometry.type !== 'LineString') throw new Error('Outline is not a line');
    const longitudes = outline.geometry.coordinates.map(([longitude]) => longitude);
    const steps = longitudes.slice(1).map((longitude, index) => longitude - longitudes[index]);
    expect(Math.max(...steps.map(Math.abs))).toBeLessThan(1);
  });
});
