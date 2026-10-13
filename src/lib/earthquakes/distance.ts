import type { SearchCenter } from './search-schema';

export const EARTH_RADIUS_KM = 6371.0088;

export function getRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function getDistanceKm(a: SearchCenter, b: SearchCenter): number {
  const dLat = getRadians(b.latitude - a.latitude);
  const dLon = getRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(getRadians(a.latitude)) * Math.cos(getRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
