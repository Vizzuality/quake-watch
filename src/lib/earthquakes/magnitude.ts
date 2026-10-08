import type { ExpressionSpecification } from 'maplibre-gl';

import type { Earthquake } from './types';

export const MAGNITUDE_RADIUS_STOPS: ReadonlyArray<readonly [number, number]> = [
  [2.5, 3],
  [4, 6],
  [5, 10],
  [6, 16],
  [7, 26],
  [8, 40],
];

export const MAGNITUDE_COLOR_STOPS: ReadonlyArray<readonly [number, string]> = [
  [2.5, '#fde68a'],
  [4, '#fbbf24'],
  [5, '#f97316'],
  [6, '#ef4444'],
  [7, '#e11d48'],
  [8, '#e11d48'],
];

export type QuakeFeatureProperties = {
  id: string;
  magnitude: number;
  place: string;
  time: number;
};

export type QuakeFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: QuakeFeatureProperties;
};

export type QuakeFeatureCollection = {
  type: 'FeatureCollection';
  features: QuakeFeature[];
};

export function getMagnitudeRadiusExpression(): ExpressionSpecification {
  return ['interpolate', ['linear'], ['get', 'magnitude'], ...MAGNITUDE_RADIUS_STOPS.flat()];
}

export function getMagnitudeColorExpression(): ExpressionSpecification {
  return ['interpolate', ['linear'], ['get', 'magnitude'], ...MAGNITUDE_COLOR_STOPS.flat()];
}

function getStopValue<T>(stops: ReadonlyArray<readonly [number, T]>, magnitude: number): T {
  const stop = stops.find(([stopMagnitude]) => stopMagnitude === magnitude);
  if (!stop) throw new Error(`No map stop defined for magnitude ${magnitude}`);
  return stop[1];
}

export function getMagnitudeSwatch(magnitude: number): { diameter: number; color: string } {
  return {
    diameter: getStopValue(MAGNITUDE_RADIUS_STOPS, magnitude) * 2,
    color: getStopValue(MAGNITUDE_COLOR_STOPS, magnitude),
  };
}

export function getEarthquakesGeoJson(quakes: Earthquake[]): QuakeFeatureCollection {
  const features = [...quakes]
    .sort((a, b) => a.magnitude - b.magnitude)
    .map(({ id, magnitude, place, time, longitude, latitude }): QuakeFeature => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
      properties: { id, magnitude, place, time },
    }));

  return { type: 'FeatureCollection', features };
}
