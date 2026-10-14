import { getRadians } from '@/lib/earthquakes/distance';

import { KM_PER_DEGREE } from './block';

export type TileCoord = { z: number; x: number; y: number };

export type OrbitLimits = {
  minPolarAngle: number;
  maxPolarAngle: number;
  minZoom: number;
  maxZoom: number;
  enablePan: false;
};

export const ISOMETRIC_CAMERA = {
  azimuthRad: Math.PI / 4,
  elevationRad: Math.atan(1 / Math.SQRT2),
} as const;

const WEB_MERCATOR_EQUATOR_KM = 2 * Math.PI * 6378.137;
const MAX_MERCATOR_LATITUDE = 85.051_128_78;
const MAX_TILE_SPAN = 3;
const MAX_TERRARIUM_ZOOM = 12;
const MIN_POLAR_ANGLE = 0.2 * Math.PI;
const MAX_POLAR_ANGLE = 0.4 * Math.PI;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.5;

function getClamped(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getMercatorLatitude(latitude: number): number {
  return getClamped(latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
}

function getTileX(longitude: number, n: number): number {
  return Math.floor(((longitude + 180) / 360) * n);
}

function getTileY(latitude: number, n: number): number {
  const radians = getRadians(getMercatorLatitude(latitude));
  const mercatorY = Math.log(Math.tan(radians) + 1 / Math.cos(radians));
  return getClamped(Math.floor(((1 - mercatorY / Math.PI) / 2) * n), 0, n - 1);
}

function getRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function getWrappedTileXs(westX: number, eastX: number, n: number): number[] {
  if (eastX - westX + 1 >= n) {
    return getRange(0, n - 1);
  }
  return getRange(westX, eastX).map((x) => ((x % n) + n) % n);
}

// https://github.com/tilezen/joerd/blob/master/docs/formats.md
export function getTerrariumElevationM(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export function getTerrariumZoom(blockSideKm: number, latitude: number): number {
  const parallelKm = WEB_MERCATOR_EQUATOR_KM * Math.cos(getRadians(getMercatorLatitude(latitude)));
  const zoom = Math.floor(Math.log2((MAX_TILE_SPAN * parallelKm) / blockSideKm));
  return getClamped(zoom, 0, MAX_TERRARIUM_ZOOM);
}

export function getTerrariumTiles(
  latitude: number,
  longitude: number,
  blockSideKm: number,
  zoom: number,
): TileCoord[] {
  const n = 2 ** zoom;
  const halfSideKm = blockSideKm / 2;
  const latitudeDelta = halfSideKm / KM_PER_DEGREE;
  const longitudeDelta =
    halfSideKm / (KM_PER_DEGREE * Math.cos(getRadians(getMercatorLatitude(latitude))));
  const xs = getWrappedTileXs(
    getTileX(longitude - longitudeDelta, n),
    getTileX(longitude + longitudeDelta, n),
    n,
  );
  const ys = getRange(getTileY(latitude + latitudeDelta, n), getTileY(latitude - latitudeDelta, n));
  return ys.flatMap((y) => xs.map((x) => ({ z: zoom, x, y })));
}

export function getTerrariumTileUrl(tile: TileCoord): string {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${tile.z}/${tile.x}/${tile.y}.png`;
}

export function getOrbitLimits(): OrbitLimits {
  return {
    minPolarAngle: MIN_POLAR_ANGLE,
    maxPolarAngle: MAX_POLAR_ANGLE,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    enablePan: false,
  };
}
