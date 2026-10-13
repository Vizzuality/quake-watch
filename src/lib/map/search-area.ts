import { EARTH_RADIUS_KM, getRadians } from '@/lib/earthquakes/distance';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';

const DEFAULT_STEPS = 64;

type Position = [number, number];

type SearchAreaFeature =
  | {
      type: 'Feature';
      geometry: { type: 'Polygon'; coordinates: Position[][] };
      properties: { kind: 'area' };
    }
  | {
      type: 'Feature';
      geometry: { type: 'Point'; coordinates: Position };
      properties: { kind: 'place' };
    };

export type SearchAreaFeatureCollection = {
  type: 'FeatureCollection';
  features: SearchAreaFeature[];
};

function getDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function getCirclePosition(center: SearchCenter, radiusKm: number, bearing: number): Position {
  const lat = getRadians(center.latitude);
  const angularDistance = radiusKm / EARTH_RADIUS_KM;
  const latitude = Math.asin(
    Math.sin(lat) * Math.cos(angularDistance) +
      Math.cos(lat) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const longitudeOffset = Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat),
    Math.cos(angularDistance) - Math.sin(lat) * Math.sin(latitude),
  );
  return [center.longitude + getDegrees(longitudeOffset), getDegrees(latitude)];
}

export function getSearchAreaGeoJson(
  center: SearchCenter,
  radiusKm: number,
  steps = DEFAULT_STEPS,
): SearchAreaFeatureCollection {
  const ring = Array.from({ length: steps }, (_, index) =>
    getCirclePosition(center, radiusKm, (2 * Math.PI * index) / steps),
  );

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
        properties: { kind: 'area' },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [center.longitude, center.latitude] },
        properties: { kind: 'place' },
      },
    ],
  };
}
