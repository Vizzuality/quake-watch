import type { SearchArea } from '../earthquakes/search-area';
import { getFeltRing } from './map-felt-rings';
import { EARTH_RADIUS_KM } from './quakes';

export const SEARCH_AREA_LOOK = {
  rgb: [230, 228, 245],
  strokePx: 1,
  strokeA: 0.5,
  centrePx: 2.5,
  centreA: 0.9,
} as const;

type SearchAreaFeature =
  | {
      type: 'Feature';
      geometry: { type: 'LineString'; coordinates: [number, number][] };
      properties: Record<string, never>;
    }
  | {
      type: 'Feature';
      geometry: { type: 'Point'; coordinates: [number, number] };
      properties: Record<string, never>;
    };

export type SearchAreaFeatureCollection = {
  type: 'FeatureCollection';
  features: SearchAreaFeature[];
};

export function getSearchAreaAngle({ radiusKm }: SearchArea): number {
  return radiusKm / EARTH_RADIUS_KM;
}

export function getSearchAreaFeatures(area: SearchArea | null): SearchAreaFeatureCollection {
  if (area === null) return { type: 'FeatureCollection', features: [] };
  const { latitude, longitude, radiusKm } = area;
  const { outline } = getFeltRing(latitude, longitude, radiusKm);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: outline },
        properties: {},
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
        properties: {},
      },
    ],
  };
}
