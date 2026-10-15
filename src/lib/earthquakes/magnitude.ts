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

export const MAGNITUDE_CLASS_BREAKS = [3, 4, 5, 6, 7] as const;

export const MAGNITUDE_CLASSES = [1, 2, 3, 4, 5, 6] as const;

export type MagnitudeClass = (typeof MAGNITUDE_CLASSES)[number];

export type MagnitudeColors = readonly [string, string, string, string, string, string];

export type QuakeFeatureProperties = {
  id: string;
  magnitude: number;
  place: string | null;
  time: number;
  depthKm: number;
  magnitudeType: string | null;
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

export function getMagnitudeColorExpression(colors: MagnitudeColors): ExpressionSpecification {
  const [below, ...above] = colors;
  return [
    'step',
    ['get', 'magnitude'],
    below,
    ...MAGNITUDE_CLASS_BREAKS.flatMap((magnitude, index) => [magnitude, above[index]!]),
  ];
}

export function getMagnitudeClass(magnitude: number): MagnitudeClass {
  return MAGNITUDE_CLASSES[MAGNITUDE_CLASS_BREAKS.filter((min) => magnitude >= min).length]!;
}

export function getMagnitudeClassMinimum(magnitudeClass: MagnitudeClass): number | null {
  return magnitudeClass === 1 ? null : MAGNITUDE_CLASS_BREAKS[magnitudeClass - 2]!;
}

export function getMagnitudeRadius(magnitude: number): number {
  const [first] = MAGNITUDE_RADIUS_STOPS;
  const last = MAGNITUDE_RADIUS_STOPS.at(-1)!;
  if (magnitude <= first![0]) return first![1];
  if (magnitude >= last[0]) return last[1];
  const upperIndex = MAGNITUDE_RADIUS_STOPS.findIndex(([stop]) => stop >= magnitude);
  const [lowMagnitude, lowRadius] = MAGNITUDE_RADIUS_STOPS[upperIndex - 1]!;
  const [highMagnitude, highRadius] = MAGNITUDE_RADIUS_STOPS[upperIndex]!;
  const progress = (magnitude - lowMagnitude) / (highMagnitude - lowMagnitude);
  return lowRadius + (highRadius - lowRadius) * progress;
}

export function getEarthquakesGeoJson(quakes: Earthquake[]): QuakeFeatureCollection {
  const features = [...quakes]
    .sort((a, b) => a.magnitude - b.magnitude)
    .map(
      ({
        id,
        magnitude,
        place,
        time,
        depthKm,
        magnitudeType,
        longitude,
        latitude,
      }): QuakeFeature => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
        properties: { id, magnitude, place, time, depthKm, magnitudeType },
      }),
    );

  return { type: 'FeatureCollection', features };
}
