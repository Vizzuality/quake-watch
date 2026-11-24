import { describe, expect, it } from 'vitest';

import {
  type PlaceExtent,
  getAreaEarthquakes,
  getDistanceKm,
  getExtentRadius,
  getSearchArea,
} from './search-area';

const GRANADA = { latitude: 37.17, longitude: -3.6 };

describe('getSearchArea', () => {
  it('has no area without a centre', () => {
    expect(getSearchArea({ plat: undefined, plon: undefined, radius: 100 })).toBeNull();
  });

  it('reads the centre and radius', () => {
    expect(getSearchArea({ plat: 37.17, plon: -3.6, radius: 250 })).toEqual({
      ...GRANADA,
      radiusKm: 250,
    });
  });
});

describe('getDistanceKm', () => {
  it('measures the great-circle distance', () => {
    expect(getDistanceKm(GRANADA, { latitude: 40.42, longitude: -3.7 })).toBeCloseTo(361, 0);
  });

  it('measures across the antimeridian the short way', () => {
    expect(
      getDistanceKm({ latitude: 0, longitude: 179.5 }, { latitude: 0, longitude: -179.5 }),
    ).toBeCloseTo(111.2, 0);
  });
});

describe('getAreaEarthquakes', () => {
  const quakes = [
    { id: 'granada', ...GRANADA },
    { id: 'malaga', latitude: 36.72, longitude: -4.42 },
    { id: 'madrid', latitude: 40.42, longitude: -3.7 },
  ];

  it('keeps every Earthquake without an area', () => {
    expect(getAreaEarthquakes(quakes, null)).toBe(quakes);
  });

  it('keeps the Earthquakes within the radius', () => {
    const area = { ...GRANADA, radiusKm: 100 as const };
    expect(getAreaEarthquakes(quakes, area).map(({ id }) => id)).toEqual(['granada', 'malaga']);
  });
});

describe('getExtentRadius', () => {
  it.each<[string, PlaceExtent | undefined, number]>([
    ['no extent', undefined, 100],
    ['Granada city', [-3.7, 37.23, -3.5, 37.14], 50],
    ['Andalucía', [-7.52, 38.73, -1.63, 35.94], 250],
    ['Spain', [-18.39, 43.99, 4.59, 27.43], 500],
    ['an antimeridian island group', [177, -16, -178, -20], 250],
  ])('sizes %s to %i km', (_name, extent, radius) => {
    expect(getExtentRadius(extent)).toBe(radius);
  });
});
