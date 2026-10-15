import { describe, expect, it } from 'vitest';

import {
  getEarthquakesGeoJson,
  getMagnitudeClass,
  getIsMagnitudeClassBelow,
  getMagnitudeClassMinimum,
  getMagnitudeColorExpression,
  getMagnitudeRadius,
  getMagnitudeRadiusExpression,
  MAGNITUDE_RADIUS_STOPS,
} from '@/lib/earthquakes/magnitude';
import type { MagnitudeColors } from '@/lib/earthquakes/magnitude';
import type { Earthquake } from '@/lib/earthquakes/types';

function getStopInputs(expression: unknown[]): number[] {
  return expression.slice(3).filter((_, index) => index % 2 === 0) as number[];
}

function makeQuake(id: string, magnitude: number): Earthquake {
  return {
    id,
    source: 'usgs',
    magnitude,
    magnitudeType: 'mww',
    place: `place ${id}`,
    time: 1,
    depthKm: 5,
    longitude: 10,
    latitude: 20,
    url: 'u',
  };
}

describe('radius expression', () => {
  const expression = getMagnitudeRadiusExpression() as unknown[];

  it('interpolates on the magnitude property', () => {
    expect(expression[0]).toBe('interpolate');
    expect(expression[2]).toEqual(['get', 'magnitude']);
  });

  it('is built from the exported stops', () => {
    expect(expression.slice(3)).toEqual(MAGNITUDE_RADIUS_STOPS.flat());
  });

  it('has ascending stops from 2.5 to 8', () => {
    const inputs = getStopInputs(expression);
    expect(inputs[0]).toBe(2.5);
    expect(inputs.at(-1)).toBe(8);
    expect(inputs).toEqual([...inputs].sort((a, b) => a - b));
  });
});

describe('getMagnitudeColorExpression', () => {
  const colors: MagnitudeColors = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

  it('steps through one color per magnitude class', () => {
    expect(getMagnitudeColorExpression(colors)).toEqual([
      'step',
      ['get', 'magnitude'],
      'c1',
      3,
      'c2',
      4,
      'c3',
      5,
      'c4',
      6,
      'c5',
      7,
      'c6',
    ]);
  });
});

describe('getMagnitudeClass', () => {
  it.each([
    [1.2, 1],
    [2.9, 1],
    [3, 2],
    [3.9, 2],
    [4, 3],
    [5.3, 4],
    [6.99, 5],
    [7, 6],
    [9.1, 6],
  ])('M%s is class %s', (magnitude, magnitudeClass) => {
    expect(getMagnitudeClass(magnitude)).toBe(magnitudeClass);
  });
});

describe('getMagnitudeClassMinimum', () => {
  it('has no minimum for the lowest class and the break for the others', () => {
    expect(getMagnitudeClassMinimum(1)).toBeNull();
    expect(getMagnitudeClassMinimum(2)).toBe(3);
    expect(getMagnitudeClassMinimum(6)).toBe(7);
  });
});

describe('getIsMagnitudeClassBelow', () => {
  it('marks the classes that a minimum Magnitude filters out', () => {
    expect(getIsMagnitudeClassBelow(1, 2.5)).toBe(false);
    expect(getIsMagnitudeClassBelow(1, 3)).toBe(true);
    expect(getIsMagnitudeClassBelow(2, 4)).toBe(true);
    expect(getIsMagnitudeClassBelow(3, 4)).toBe(false);
    expect(getIsMagnitudeClassBelow(6, 6)).toBe(false);
  });
});

describe('getMagnitudeRadius', () => {
  it('matches the map radius at each stop', () => {
    for (const [magnitude, radius] of MAGNITUDE_RADIUS_STOPS) {
      expect(getMagnitudeRadius(magnitude)).toBe(radius);
    }
  });

  it('interpolates linearly between stops', () => {
    expect(getMagnitudeRadius(3.25)).toBe(4.5);
  });

  it('clamps outside the stops', () => {
    expect(getMagnitudeRadius(1)).toBe(3);
    expect(getMagnitudeRadius(9.5)).toBe(40);
  });
});

describe('getEarthquakesGeoJson', () => {
  it('sorts features ascending by magnitude', () => {
    const result = getEarthquakesGeoJson([makeQuake('a', 6), makeQuake('b', 3), makeQuake('c', 4)]);
    expect(result.features.map((f) => f.properties.id)).toEqual(['b', 'c', 'a']);
  });

  it('maps coordinates and properties', () => {
    const result = getEarthquakesGeoJson([makeQuake('a', 6)]);
    expect(result.type).toBe('FeatureCollection');
    expect(result.features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [10, 20] },
      properties: {
        id: 'a',
        magnitude: 6,
        place: 'place a',
        time: 1,
        depthKm: 5,
        magnitudeType: 'mww',
      },
    });
  });

  it('does not mutate the input', () => {
    const input = [makeQuake('a', 6), makeQuake('b', 3)];
    getEarthquakesGeoJson(input);
    expect(input.map((q) => q.id)).toEqual(['a', 'b']);
  });
});
