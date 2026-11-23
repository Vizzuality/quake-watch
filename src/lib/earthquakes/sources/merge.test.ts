import { describe, expect, it } from 'vitest';

import type { Earthquake } from '../types';
import { getMergedEarthquakes } from './merge';

const T = Date.UTC(2026, 10, 1, 12);

function getQuake(overrides: Partial<Earthquake> & Pick<Earthquake, 'id' | 'source'>): Earthquake {
  return {
    magnitude: 5,
    magnitudeType: 'mb',
    place: null,
    time: T,
    depthKm: 10,
    longitude: 140,
    latitude: 36,
    url: 'https://example.org',
    ...overrides,
  };
}

function getIds(earthquakes: Earthquake[]): string[] {
  return earthquakes.map(({ source, id }) => `${source}:${id}`);
}

describe('getMergedEarthquakes', () => {
  it('keeps the USGS record of an Earthquake both catalogues report', () => {
    const emsc = [getQuake({ id: 'e1', source: 'emsc', time: T + 2_000, latitude: 36.1 })];
    const usgs = [getQuake({ id: 'u1', source: 'usgs', magnitude: 5.3 })];
    expect(getIds(getMergedEarthquakes(emsc, usgs))).toEqual(['usgs:u1']);
  });

  it.each([
    ['17 s apart', { time: T + 17_000 }],
    ['more than 100 km apart', { latitude: 37 }],
    ['more than 0.5 apart in magnitude', { magnitude: 5.6 }],
  ])('keeps both when they are %s', (_, overrides) => {
    const emsc = [getQuake({ id: 'e1', source: 'emsc', ...overrides })];
    const usgs = [getQuake({ id: 'u1', source: 'usgs' })];
    expect(getMergedEarthquakes(emsc, usgs)).toHaveLength(2);
  });

  it('matches each EMSC record to at most one USGS record', () => {
    const emsc = [getQuake({ id: 'e1', source: 'emsc' })];
    const usgs = [
      getQuake({ id: 'far', source: 'usgs', time: T + 10_000, latitude: 36.5 }),
      getQuake({ id: 'near', source: 'usgs', time: T + 1_000 }),
    ];
    expect(getIds(getMergedEarthquakes(emsc, usgs)).toSorted()).toEqual(['usgs:far', 'usgs:near']);
  });

  it('keeps the Earthquakes only one catalogue reports, newest first', () => {
    const emsc = [
      getQuake({ id: 'e-old', source: 'emsc', time: T - 60_000, longitude: 10 }),
      getQuake({ id: 'e-dup', source: 'emsc', time: T }),
    ];
    const usgs = [
      getQuake({ id: 'u-dup', source: 'usgs', time: T + 500 }),
      getQuake({ id: 'u-new', source: 'usgs', time: T + 60_000, longitude: -120 }),
    ];
    expect(getIds(getMergedEarthquakes(emsc, usgs))).toEqual([
      'usgs:u-new',
      'usgs:u-dup',
      'emsc:e-old',
    ]);
  });
});
