import { describe, expect, it } from 'vitest';

import { getEarthquakeRegion, getRegionEarthquakes, getRegionSuggestions } from './regions';
import type { Earthquake } from './types';

function getQuake(id: string, place: string | null): Earthquake {
  return {
    id,
    source: 'usgs',
    magnitude: 4,
    magnitudeType: null,
    place,
    time: 0,
    depthKm: 10,
    longitude: 0,
    latitude: 0,
    url: '',
  };
}

describe('getEarthquakeRegion', () => {
  it.each([
    ['10 km SW of Port-Vila, Vanuatu', 'Vanuatu'],
    ['152.3 km NNE of Isangel, Vanuatu', 'Vanuatu'],
    ['Vanuatu Islands', 'Vanuatu Islands'],
    ['south of the Fiji Islands', 'Fiji Islands'],
    ['off the east coast of Honshu, Japan', 'Japan'],
    ['Kermadec Islands region', 'Kermadec Islands'],
    ['Vanuatu', 'Vanuatu'],
    ['Southern Xinjiang, China', 'China'],
    ['Near Coast Of Central Chile', 'Central Chile'],
    ['Off Coast Of Northern California', 'Northern California'],
    ['South Of Fiji Islands', 'Fiji Islands'],
    ['Easter Island Region', 'Easter Island'],
  ])('reads %j as %j', (place, region) => {
    expect(getEarthquakeRegion(place)).toBe(region);
  });

  it.each([null, '', '  ', 'Somewhere, '])('has no region for %j', (place) => {
    expect(getEarthquakeRegion(place)).toBeNull();
  });
});

describe('getRegionSuggestions', () => {
  const earthquakes = [
    getQuake('a', '10 km SW of Port-Vila, Vanuatu'),
    getQuake('b', 'Vanuatu'),
    getQuake('c', '40 km E of Isangel, vanuatu'),
    getQuake('d', 'Vanuatu Islands'),
    getQuake('e', 'Southern Xinjiang, China'),
    getQuake('f', 'Central Mid-Atlantic Ridge'),
    getQuake('g', 'Near Coast Of Central Chile'),
    getQuake('h', null),
  ];

  it('lists Vanuatu with its count for "Vanu", across EMSC and USGS spellings', () => {
    expect(getRegionSuggestions(earthquakes, 'Vanu')).toEqual([
      { name: 'Vanuatu', count: 3 },
      { name: 'Vanuatu Islands', count: 1 },
    ]);
  });

  it('ranks names that start with the query before names that contain it', () => {
    expect(getRegionSuggestions(earthquakes, 'ch').map(({ name }) => name)).toEqual([
      'China',
      'Central Chile',
    ]);
  });

  it('ignores case and accents', () => {
    expect(getRegionSuggestions([getQuake('a', 'México')], 'MEXI')).toEqual([
      { name: 'México', count: 1 },
    ]);
  });

  it('returns up to six suggestions, the most active first', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      Array.from({ length: index + 1 }, (__, n) => getQuake(`${index}-${n}`, `Island ${index}`)),
    ).flat();

    expect(getRegionSuggestions(many, 'island').map(({ count }) => count)).toEqual([
      8, 7, 6, 5, 4, 3,
    ]);
  });

  it('suggests nothing for a blank query or an unknown place', () => {
    expect(getRegionSuggestions(earthquakes, '  ')).toEqual([]);
    expect(getRegionSuggestions(earthquakes, 'Atlantis')).toEqual([]);
  });
});

describe('getRegionEarthquakes', () => {
  it("keeps only the place's Earthquakes, whatever the case", () => {
    const earthquakes = [
      getQuake('a', '10 km SW of Port-Vila, Vanuatu'),
      getQuake('b', 'Vanuatu Islands'),
      getQuake('c', 'VANUATU'),
      getQuake('d', null),
    ];

    expect(getRegionEarthquakes(earthquakes, 'vanuatu').map(({ id }) => id)).toEqual(['a', 'c']);
  });
});
