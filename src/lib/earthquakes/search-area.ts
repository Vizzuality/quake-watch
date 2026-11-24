import { EARTH_RADIUS_KM } from '@/lib/globe/quakes';

import {
  DEFAULT_SEARCH_RADIUS_KM,
  type EarthquakeSearch,
  SEARCH_RADII_KM,
  type SearchRadiusKm,
} from './search-schema';

const KM_PER_DEGREE = (Math.PI * EARTH_RADIUS_KM) / 180;
const MAX_SEARCH_RADIUS_KM = SEARCH_RADII_KM[SEARCH_RADII_KM.length - 1];

type Located = { latitude: number; longitude: number };

export type SearchArea = Located & { radiusKm: SearchRadiusKm };

export type PlaceExtent = [minLon: number, maxLat: number, maxLon: number, minLat: number];

function getRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function getSearchArea({
  plat,
  plon,
  radius,
}: Pick<EarthquakeSearch, 'plat' | 'plon' | 'radius'>): SearchArea | null {
  if (plat === undefined || plon === undefined) return null;
  return { latitude: plat, longitude: plon, radiusKm: radius };
}

export function getDistanceKm(a: Located, b: Located): number {
  const dLat = getRadians(b.latitude - a.latitude);
  const dLon = getRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(getRadians(a.latitude)) * Math.cos(getRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function getAreaEarthquakes<T extends Located>(
  earthquakes: readonly T[],
  area: SearchArea | null,
): readonly T[] {
  if (area === null) return earthquakes;
  return earthquakes.filter((earthquake) => getDistanceKm(area, earthquake) <= area.radiusKm);
}

export function getExtentRadius(extent: PlaceExtent | undefined): SearchRadiusKm {
  if (extent === undefined) return DEFAULT_SEARCH_RADIUS_KM;
  const [minLon, maxLat, maxLon, minLat] = extent;
  const lonSpan = (((maxLon - minLon) % 360) + 360) % 360;
  const midLat = getRadians((maxLat + minLat) / 2);
  const widthKm = lonSpan * KM_PER_DEGREE * Math.cos(midLat);
  const heightKm = Math.abs(maxLat - minLat) * KM_PER_DEGREE;
  const halfSideKm = Math.min(widthKm, heightKm) / 2;
  return SEARCH_RADII_KM.find((radius) => radius >= halfSideKm) ?? MAX_SEARCH_RADIUS_KM;
}
