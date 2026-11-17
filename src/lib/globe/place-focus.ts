import type { Earthquake } from '../earthquakes/types';
import { SELECT_MIN_ZOOM } from './motion';

export const PLACE_MAX_ZOOM = 3;
const PLACE_FILL = 0.6;

type Located = Pick<Earthquake, 'latitude' | 'longitude'>;
type Vector = [number, number, number];

export type PlaceFocus = { latitude: number; longitude: number; zoom: number };

function getRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function getVector({ latitude, longitude }: Located): Vector {
  const lat = getRadians(latitude);
  const lon = getRadians(longitude);
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

function getAngle(a: Vector, b: Vector): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}

function getPlaceZoom(spread: number): number {
  const zoom = PLACE_FILL / Math.sin(Math.min(spread, Math.PI / 2));
  return Math.min(PLACE_MAX_ZOOM, Math.max(SELECT_MIN_ZOOM, zoom));
}

export function getPlaceFocus(earthquakes: readonly Located[]): PlaceFocus | null {
  if (earthquakes.length === 0) return null;
  const vectors = earthquakes.map(getVector);
  const [x, y, z] = vectors.reduce<Vector>(
    (sum, vector) => [sum[0] + vector[0], sum[1] + vector[1], sum[2] + vector[2]],
    [0, 0, 0],
  );
  const length = Math.hypot(x, y, z);
  if (length === 0) return null;
  const centre: Vector = [x / length, y / length, z / length];
  const spread = Math.max(...vectors.map((vector) => getAngle(vector, centre)));
  return {
    latitude: getDegrees(Math.asin(centre[2])),
    longitude: getDegrees(Math.atan2(centre[1], centre[0])),
    zoom: getPlaceZoom(spread),
  };
}
