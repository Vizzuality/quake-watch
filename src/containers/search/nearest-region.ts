import { getEarthquakeRegion } from '@/lib/earthquakes/regions';
import type { Earthquake } from '@/lib/earthquakes/types';
import { EARTH_RADIUS_KM } from '@/lib/globe/quakes';

const NEAREST_REGION_MAX_KM = 1500;
const MAX_ANGLE = NEAREST_REGION_MAX_KM / EARTH_RADIUS_KM;

type Located = { latitude: number; longitude: number };

function getRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getCentralAngle(a: Located, b: Located): number {
  const latA = getRadians(a.latitude);
  const latB = getRadians(b.latitude);
  const cosine =
    Math.sin(latA) * Math.sin(latB) +
    Math.cos(latA) * Math.cos(latB) * Math.cos(getRadians(b.longitude - a.longitude));
  return Math.acos(Math.min(1, Math.max(-1, cosine)));
}

export function getNearestRegion(
  earthquakes: readonly Earthquake[],
  position: Located,
): string | null {
  let nearest: string | null = null;
  let nearestAngle = MAX_ANGLE;
  for (const earthquake of earthquakes) {
    const region = getEarthquakeRegion(earthquake.place);
    if (region === null) continue;
    const angle = getCentralAngle(position, earthquake);
    if (angle >= nearestAngle) continue;
    nearest = region;
    nearestAngle = angle;
  }
  return nearest;
}
