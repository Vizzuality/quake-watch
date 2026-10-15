import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import { getCirclePosition } from '@/lib/map/search-area';

import { P_WAVE_KM_S, S_WAVE_KM_S, getWaveRadiusKm } from './wave';

export type WaveKind = 'p' | 's';
type Position = [number, number];
export type WaveFront = {
  type: 'Feature';
  properties: { wave: WaveKind };
  geometry: { type: 'LineString'; coordinates: Position[] };
};
export type WaveFronts = { type: 'FeatureCollection'; features: WaveFront[] };

const FRONT_STEPS = 128;
const WAVE_SPEEDS: ReadonlyArray<readonly [WaveKind, number]> = [
  ['p', P_WAVE_KM_S],
  ['s', S_WAVE_KM_S],
];

export function getWaveFrontRing(epicenter: SearchCenter, radiusKm: number): Position[] {
  return Array.from({ length: FRONT_STEPS + 1 }, (_, index) =>
    getCirclePosition(epicenter, radiusKm, (2 * Math.PI * index) / FRONT_STEPS),
  );
}

function getWaveFront(epicenter: SearchCenter, radiusKm: number, wave: WaveKind): WaveFront {
  return {
    type: 'Feature',
    properties: { wave },
    geometry: { type: 'LineString', coordinates: getWaveFrontRing(epicenter, radiusKm) },
  };
}

export function getWaveFronts(
  epicenter: SearchCenter,
  depthKm: number,
  seconds: number,
  visible: boolean,
): WaveFronts {
  if (!visible) return { type: 'FeatureCollection', features: [] };
  const features = WAVE_SPEEDS.flatMap(([wave, speed]) => {
    const radiusKm = getWaveRadiusKm(seconds, depthKm, speed);
    return radiusKm > 0 ? [getWaveFront(epicenter, radiusKm, wave)] : [];
  });
  return { type: 'FeatureCollection', features };
}
