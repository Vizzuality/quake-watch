import { getDepthRgb } from '../earthquakes/depth-color';
import type { Earthquake } from '../earthquakes/types';
import { getLatLonVector } from './sphere';

export const GLOBE_DEPTH_EXAGGERATION = 7;
export const EARTH_RADIUS_KM = 6371;
export const MAX_QUAKE_DEPTH_KM = 700;
export const MIN_HYPOCENTRE_RADIUS = 0.15;
export const QUAKE_MARKER_LOOK = {
  epicentreA: 0.9,
  hypocentreA: 0.85,
  needleA: 0.6,
  needleBaseK: 0.5,
} as const;

const MIN_AMPLITUDE = 0.12;

type MarkerAttributes = {
  direction: Float32Array;
  radius: Float32Array;
  size: Float32Array;
  color: Float32Array;
  alpha: Float32Array;
};

export type QuakeVertexAttributes = Omit<MarkerAttributes, 'size'>;

export type QuakeMarkerAttributes = { markers: MarkerAttributes; needles: QuakeVertexAttributes };

export function getHypocentreRadius(depthKm: number): number {
  if (Number.isNaN(depthKm) || depthKm < 0) return 1;
  const depth = Math.min(depthKm, MAX_QUAKE_DEPTH_KM);
  return Math.max(MIN_HYPOCENTRE_RADIUS, 1 - (depth * GLOBE_DEPTH_EXAGGERATION) / EARTH_RADIUS_KM);
}

export function getQuakeAmplitude(magnitude: number): number {
  if (Number.isNaN(magnitude)) return MIN_AMPLITUDE;
  return Math.min(1, Math.max(MIN_AMPLITUDE, (magnitude - 2) / 4.4));
}

export function getEpicentreRadiusPx(magnitude: number): number {
  return (1.3 + 2.2 * getQuakeAmplitude(magnitude)) * 0.5;
}

export function getHypocentreRadiusPx(magnitude: number): number {
  return (1.6 + 3.2 * getQuakeAmplitude(magnitude)) * 0.5;
}

function getEmptyNeedleAttributes(vertexCount: number): QuakeVertexAttributes {
  return {
    direction: new Float32Array(vertexCount * 3),
    radius: new Float32Array(vertexCount),
    color: new Float32Array(vertexCount * 3),
    alpha: new Float32Array(vertexCount),
  };
}

function getEmptyMarkerAttributes(vertexCount: number): MarkerAttributes {
  return { ...getEmptyNeedleAttributes(vertexCount), size: new Float32Array(vertexCount) };
}

export function getQuakeMarkerAttributes(
  earthquakes: readonly Earthquake[],
): QuakeMarkerAttributes {
  const vertexCount = earthquakes.length * 2;
  const markers = getEmptyMarkerAttributes(vertexCount);
  const needles = getEmptyNeedleAttributes(vertexCount);
  const needleA = QUAKE_MARKER_LOOK.needleA;

  earthquakes.forEach((earthquake, index) => {
    const epicentre = index * 2;
    const hypocentre = epicentre + 1;
    const direction = getLatLonVector(earthquake.latitude, earthquake.longitude);
    const color = getDepthRgb(earthquake.depthKm).map((channel) => channel / 255);
    const radius = getHypocentreRadius(earthquake.depthKm);

    for (const vertex of [epicentre, hypocentre]) {
      markers.direction.set(direction, vertex * 3);
      markers.color.set(color, vertex * 3);
      needles.direction.set(direction, vertex * 3);
      needles.color.set(color, vertex * 3);
    }
    markers.radius[epicentre] = 1;
    markers.radius[hypocentre] = radius;
    needles.radius[epicentre] = 1;
    needles.radius[hypocentre] = radius;
    markers.size[epicentre] = getEpicentreRadiusPx(earthquake.magnitude);
    markers.size[hypocentre] = getHypocentreRadiusPx(earthquake.magnitude);
    markers.alpha[epicentre] = QUAKE_MARKER_LOOK.epicentreA;
    markers.alpha[hypocentre] = QUAKE_MARKER_LOOK.hypocentreA;
    needles.alpha[epicentre] = needleA * QUAKE_MARKER_LOOK.needleBaseK;
    needles.alpha[hypocentre] = needleA;
  });

  return { markers, needles };
}
