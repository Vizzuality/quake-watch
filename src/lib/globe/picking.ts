import type { Earthquake } from '../earthquakes/types';
import type { GlobeView } from './motion';
import { getHypocentreRadius } from './quakes';
import { getLatLonVector, getRotatedVector } from './sphere';
import type { Vector3 } from './sphere';

export const PICK_TOLERANCE_PX = 12;

export type GlobeFrame = { cx: number; cy: number; radius: number };
export type QuakeScreenPoint = { index: number; x: number; y: number };

function getScaledVector([x, y, z]: Vector3, scale: number): Vector3 {
  return [x * scale, y * scale, z * scale];
}

export function getQuakeScreenPoints(
  earthquakes: readonly Earthquake[],
  view: GlobeView,
  frame: GlobeFrame,
): QuakeScreenPoint[] {
  const scale = frame.radius * view.zoom;
  const points: QuakeScreenPoint[] = [];
  earthquakes.forEach((earthquake, index) => {
    const direction = getLatLonVector(earthquake.latitude, earthquake.longitude);
    const epicentre = getRotatedVector(direction, view.lon, view.lat);
    if (epicentre[2] < 0) return;
    const hypocentre = getRotatedVector(
      getScaledVector(direction, getHypocentreRadius(earthquake.depthKm)),
      view.lon,
      view.lat,
    );
    for (const [x, y] of [epicentre, hypocentre]) {
      points.push({ index, x: frame.cx + x * scale, y: frame.cy - y * scale });
    }
  });
  return points;
}

export function getPickedQuakeIndex(
  points: readonly QuakeScreenPoint[],
  x: number,
  y: number,
  tolerancePx = PICK_TOLERANCE_PX,
): number | null {
  let picked: number | null = null;
  let nearest = tolerancePx * tolerancePx;
  for (const point of points) {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance <= nearest) {
      nearest = distance;
      picked = point.index;
    }
  }
  return picked;
}
