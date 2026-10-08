import { describe, expect, it } from 'vitest';

import {
  getEarthquakesGeoJson,
  getMagnitudeSwatch,
  MAGNITUDE_COLOR_STOPS,
  MAGNITUDE_RADIUS_STOPS,
  getMagnitudeColorExpression,
  getMagnitudeRadiusExpression,
} from '@/lib/earthquakes/magnitude';
import type { Earthquake } from '@/lib/earthquakes/types';

function getStopInputs(expression: unknown[]): number[] {
  return expression.slice(3).filter((_, index) => index % 2 === 0) as number[];
}

function makeQuake(id: string, magnitude: number): Earthquake {
  return {
    id,
    magnitude,
    place: `place ${id}`,
    time: 1,
    depthKm: 5,
    longitude: 10,
    latitude: 20,
    url: 'u',
  };
}

describe.each([
  ['radius', getMagnitudeRadiusExpression, MAGNITUDE_RADIUS_STOPS],
  ['color', getMagnitudeColorExpression, MAGNITUDE_COLOR_STOPS],
])('%s expression', (_name, getExpression, stops) => {
  const expression = getExpression() as unknown[];

  it('interpolates on the magnitude property', () => {
    expect(expression[0]).toBe('interpolate');
    expect(expression[2]).toEqual(['get', 'magnitude']);
  });

  it('is built from the exported stops', () => {
    expect(expression.slice(3)).toEqual(stops.flat());
  });

  it('has ascending stops from 2.5 to 8', () => {
    const inputs = getStopInputs(expression);
    expect(inputs[0]).toBe(2.5);
    expect(inputs.at(-1)).toBe(8);
    expect(inputs).toEqual([...inputs].sort((a, b) => a - b));
  });
});

describe('getMagnitudeSwatch', () => {
  it('returns the map diameter and colour for a stop magnitude', () => {
    expect(getMagnitudeSwatch(5)).toEqual({ diameter: 20, color: '#f97316' });
    expect(getMagnitudeSwatch(4)).toEqual({ diameter: 12, color: '#fbbf24' });
  });

  it('throws for a magnitude without a stop', () => {
    expect(() => getMagnitudeSwatch(3)).toThrow('No map stop defined for magnitude 3');
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
      properties: { id: 'a', magnitude: 6, place: 'place a', time: 1 },
    });
  });

  it('does not mutate the input', () => {
    const input = [makeQuake('a', 6), makeQuake('b', 3)];
    getEarthquakesGeoJson(input);
    expect(input.map((q) => q.id)).toEqual(['a', 'b']);
  });
});
