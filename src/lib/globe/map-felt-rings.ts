import { EARTH_RADIUS_KM } from './quakes';

export type LngLat = [number, number];
export type LngLatBounds = [LngLat, LngLat];

const RING_STEPS = 64;
const MERCATOR_MAX_LAT = 85.051129;

function getRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function getClampedLat(lat: number): number {
  return Math.min(MERCATOR_MAX_LAT, Math.max(-MERCATOR_MAX_LAT, lat));
}

function getDestination(lat: number, lon: number, angle: number, bearing: number): LngLat {
  const phi = getRadians(lat);
  const sinPhi =
    Math.sin(phi) * Math.cos(angle) + Math.cos(phi) * Math.sin(angle) * Math.cos(bearing);
  const lambda = Math.atan2(
    Math.sin(bearing) * Math.sin(angle) * Math.cos(phi),
    Math.cos(angle) - Math.sin(phi) * sinPhi,
  );
  return [lon + getDegrees(lambda), getDegrees(Math.asin(sinPhi))];
}

function getContinuousRing(lat: number, lon: number, angle: number): LngLat[] {
  const ring: LngLat[] = [];
  for (let step = 0; step < RING_STEPS; step++) {
    const [vertexLon, vertexLat] = getDestination(
      lat,
      lon,
      angle,
      (2 * Math.PI * step) / RING_STEPS,
    );
    const previousLon = ring.at(-1)?.[0] ?? lon;
    const turns = Math.round((previousLon - vertexLon) / 360);
    ring.push([vertexLon + turns * 360, getClampedLat(vertexLat)]);
  }
  return ring;
}

function getClosedRing(ring: LngLat[]): LngLat[] {
  return [...ring, ring[0]];
}

function getShiftedRing(ring: LngLat[]): LngLat[] {
  const west = Math.min(...ring.map(([lon]) => lon));
  const offset = -360 * Math.floor((west + 180) / 360);
  return ring.map(([lon, lat]) => [lon + offset, lat]);
}

function getWrappedRing(ring: LngLat[]): LngLat[] {
  const first = ring[0];
  const last = ring.at(-1) ?? first;
  return [...ring, [first[0] + Math.sign(last[0] - first[0]) * 360, first[1]]];
}

function getPoleRing(outline: LngLat[], poleLat: number): LngLat[] {
  const first = outline[0];
  const seam = outline.at(-1) ?? first;
  return [...outline, [seam[0], poleLat], [first[0], poleLat], first];
}

function getWorldRing(centreLon: number): LngLat[] {
  const west = centreLon - 180;
  const east = centreLon + 180;
  return [
    [west, -MERCATOR_MAX_LAT],
    [east, -MERCATOR_MAX_LAT],
    [east, MERCATOR_MAX_LAT],
    [west, MERCATOR_MAX_LAT],
    [west, -MERCATOR_MAX_LAT],
  ];
}

export type FeltRing = { polygon: LngLat[][]; outline: LngLat[]; hasPole: boolean };

export function getFeltRing(lat: number, lon: number, reachKm: number): FeltRing {
  const angle = reachKm / EARTH_RADIUS_KM;
  const phi = getRadians(lat);
  const hasNorthPole = angle > Math.PI / 2 - phi;
  const hasSouthPole = angle > Math.PI / 2 + phi;
  if (hasNorthPole && hasSouthPole) {
    const antipodeLon = lon + 180;
    const hole = getClosedRing(getContinuousRing(-lat, antipodeLon, Math.PI - angle));
    return { polygon: [getWorldRing(antipodeLon), hole], outline: hole, hasPole: true };
  }
  const ring = getContinuousRing(lat, lon, angle);
  if (!hasNorthPole && !hasSouthPole) {
    const closed = getClosedRing(ring);
    return { polygon: [closed], outline: closed, hasPole: false };
  }
  const outline = getShiftedRing(getWrappedRing(ring));
  const poleLat = hasNorthPole ? MERCATOR_MAX_LAT : -MERCATOR_MAX_LAT;
  return { polygon: [getPoleRing(outline, poleLat)], outline, hasPole: true };
}

export function getFeltRingBounds(ring: readonly LngLat[]): LngLatBounds {
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}
