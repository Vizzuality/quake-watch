import { describe, expect, it } from 'vitest';

import { getLargestEarthquakes } from './largest';
import type { Earthquake } from './types';

function getEarthquake(id: string, magnitude: number, time: number): Earthquake {
  return {
    id,
    source: 'emsc',
    magnitude,
    magnitudeType: 'mb',
    place: null,
    time,
    depthKm: 10,
    longitude: 0,
    latitude: 0,
    url: '',
  };
}

describe('getLargestEarthquakes', () => {
  it('returns the N largest by magnitude, descending', () => {
    const earthquakes = [
      getEarthquake('a', 3.1, 1),
      getEarthquake('b', 5.6, 2),
      getEarthquake('c', 4.2, 3),
      getEarthquake('d', 6.0, 4),
    ];
    expect(getLargestEarthquakes(earthquakes, 3).map(({ id }) => id)).toEqual(['d', 'b', 'c']);
  });

  it('breaks magnitude ties by most recent time first', () => {
    const earthquakes = [getEarthquake('old', 5.5, 1), getEarthquake('new', 5.5, 9)];
    expect(getLargestEarthquakes(earthquakes, 2).map(({ id }) => id)).toEqual(['new', 'old']);
  });

  it('returns all when fewer than N', () => {
    expect(getLargestEarthquakes([getEarthquake('a', 3, 1)], 5)).toHaveLength(1);
  });

  it('returns [] for []', () => {
    expect(getLargestEarthquakes([], 5)).toEqual([]);
  });

  it('does not mutate the input', () => {
    const earthquakes = [getEarthquake('a', 3, 1), getEarthquake('b', 6, 2)];
    getLargestEarthquakes(earthquakes, 1);
    expect(earthquakes.map(({ id }) => id)).toEqual(['a', 'b']);
  });
});
