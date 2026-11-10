import { getDepthRgb } from '../earthquakes/depth-color';
import { getFeltReachKm } from '../earthquakes/intensity';
import type { Earthquake } from '../earthquakes/types';
import {
  getRealSeconds,
  getWaveDurationSeconds,
  getWaveRadiusKm,
  P_WAVE_KM_S,
  S_WAVE_KM_S,
} from '../earthquakes/waves';
import { EARTH_RADIUS_KM, getEpicentreRadiusPx, getQuakeAmplitude } from './quakes';
import { getLatLonVector } from './sphere';

export const FELT_RING_LOOK = {
  strokeA: 0.4,
  fillA: 0.094,
  hollowA: 0.7,
  hollowGapPx: 3,
  frontA: 0.85,
  pFrontK: 0.5,
  glowA: 0.5,
  glowBasePx: 6,
  glowAmpPx: 22,
  strokePx: 1,
  frontPx: 1.2,
} as const;

const WAVE_BASE_SECONDS = 1.4;
const WAVE_AMP_SECONDS = 2.6;

export type FeltRingAttributes = {
  direction: Float32Array;
  reachAngle: Float32Array;
  minPx: Float32Array;
  color: Float32Array;
  depthKm: Float32Array;
  life: Float32Array;
  glowPx: Float32Array;
};

export function getFeltRingAngle(magnitude: number, depthKm: number): number {
  return getFeltReachKm({ magnitude, depthKm }) / EARTH_RADIUS_KM;
}

export function getMinRingRadiusPx(magnitude: number): number {
  return getEpicentreRadiusPx(magnitude) + FELT_RING_LOOK.hollowGapPx;
}

export function getWaveLifeSeconds(magnitude: number): number {
  return WAVE_BASE_SECONDS + WAVE_AMP_SECONDS * getQuakeAmplitude(magnitude);
}

export function getGlowRadiusPx(magnitude: number): number {
  return FELT_RING_LOOK.glowBasePx + FELT_RING_LOOK.glowAmpPx * getQuakeAmplitude(magnitude);
}

export function getWaveFronts({
  progress,
  reachKm,
  depthKm,
}: {
  progress: number;
  reachKm: number;
  depthKm: number;
}): { sAngle: number; pAngle: number | null } {
  if (!(reachKm > 0)) return { sAngle: 0, pAngle: null };
  const seconds = getRealSeconds(progress, getWaveDurationSeconds(reachKm, depthKm));
  const sKm = getWaveRadiusKm(seconds, depthKm, S_WAVE_KM_S);
  const pKm = getWaveRadiusKm(seconds, depthKm, P_WAVE_KM_S);
  const pAngle = pKm > reachKm ? null : pKm / EARTH_RADIUS_KM;
  return { sAngle: sKm / EARTH_RADIUS_KM, pAngle };
}

export function getFeltRingAttributes(earthquakes: readonly Earthquake[]): FeltRingAttributes {
  const count = earthquakes.length;
  const attributes: FeltRingAttributes = {
    direction: new Float32Array(count * 3),
    reachAngle: new Float32Array(count),
    minPx: new Float32Array(count),
    color: new Float32Array(count * 3),
    depthKm: new Float32Array(count),
    life: new Float32Array(count),
    glowPx: new Float32Array(count),
  };

  earthquakes.forEach(({ latitude, longitude, magnitude, depthKm }, index) => {
    attributes.direction.set(getLatLonVector(latitude, longitude), index * 3);
    attributes.color.set(
      getDepthRgb(depthKm).map((channel) => channel / 255),
      index * 3,
    );
    attributes.reachAngle[index] = getFeltRingAngle(magnitude, depthKm);
    attributes.minPx[index] = getMinRingRadiusPx(magnitude);
    attributes.depthKm[index] = depthKm;
    attributes.life[index] = getWaveLifeSeconds(magnitude);
    attributes.glowPx[index] = getGlowRadiusPx(magnitude);
  });

  return attributes;
}
