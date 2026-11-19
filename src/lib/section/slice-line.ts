import { type LngLat, getDestination } from '@/lib/globe/map-felt-rings';
import { EARTH_RADIUS_KM } from '@/lib/globe/quakes';

import { SECTION_FRAME } from './depth-scale';

type Position = { latitude: number; longitude: number };

export type SliceOffset = { alongKm: number; northKm: number };

export const SLICE_LOOK = {
  samples: 181,
  backLines: 40,
  backStepKm: 5,
} as const;

const EAST = Math.PI / 2;
const WEST = (3 * Math.PI) / 2;
const NORTH = 0;

function getRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getAlongKm(index: number): number {
  const stepKm = SECTION_FRAME.sliceKm / (SLICE_LOOK.samples - 1);
  return index * stepKm - SECTION_FRAME.sliceKm / 2;
}

function getFrontPoint(lat: number, lon: number, alongKm: number): LngLat {
  if (alongKm === 0) return [lon, lat];
  const bearing = alongKm > 0 ? EAST : WEST;
  return getDestination(lat, lon, Math.abs(alongKm) / EARTH_RADIUS_KM, bearing);
}

function getBackPoint([lon, lat]: LngLat, northKm: number): LngLat {
  if (northKm === 0) return [lon, lat];
  return getDestination(lat, lon, northKm / EARTH_RADIUS_KM, NORTH);
}

export function getSliceAlongKm(index: number): number {
  return getAlongKm(index);
}

export function getSliceLines(lat: number, lon: number): LngLat[][] {
  const front = Array.from({ length: SLICE_LOOK.samples }, (_, index) =>
    getFrontPoint(lat, lon, getAlongKm(index)),
  );
  return Array.from({ length: SLICE_LOOK.backLines + 1 }, (_, line) =>
    front.map((point) => getBackPoint(point, line * SLICE_LOOK.backStepKm)),
  );
}

export function getSliceOffset(epicentre: Position, other: Position): SliceOffset {
  const phi1 = getRadians(epicentre.latitude);
  const phi2 = getRadians(other.latitude);
  const deltaLambda = getRadians(other.longitude - epicentre.longitude);
  const angle = Math.acos(
    Math.min(
      1,
      Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLambda),
    ),
  );
  const bearing = Math.atan2(
    Math.sin(deltaLambda) * Math.cos(phi2),
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda),
  );
  const crossAngle = Math.asin(Math.sin(angle) * Math.sin(bearing - EAST));
  const alongAngle = Math.atan2(Math.sin(angle) * Math.cos(bearing - EAST), Math.cos(angle));
  return { alongKm: alongAngle * EARTH_RADIUS_KM, northKm: -crossAngle * EARTH_RADIUS_KM };
}
