import type { SearchCenter } from '@/lib/earthquakes/search-schema';

export const KM_PER_DEGREE = 111.195;
const MAX_LATITUDE = 85;
const MAX_LONGITUDE_DELTA = 180;

export function getSearchBounds(
  { latitude, longitude }: SearchCenter,
  radiusKm: number,
): [[number, number], [number, number]] {
  const latDelta = radiusKm / KM_PER_DEGREE;
  const lonDelta = Math.min(
    radiusKm / (KM_PER_DEGREE * Math.cos((latitude * Math.PI) / 180)),
    MAX_LONGITUDE_DELTA,
  );
  const clampedLatitude = Math.min(Math.max(latitude, -MAX_LATITUDE), MAX_LATITUDE);
  return [
    [longitude - lonDelta, Math.max(clampedLatitude - latDelta, -MAX_LATITUDE)],
    [longitude + lonDelta, Math.min(clampedLatitude + latDelta, MAX_LATITUDE)],
  ];
}
