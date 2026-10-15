import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import { getCirclePosition } from '@/lib/map/search-area';

import { WAVE_SPEEDS_KM_S, getWaveRadiusKm } from './wave';
import type { WaveKind } from './wave';

type Position = [number, number];
export type WaveFront = {
  type: 'Feature';
  properties: { wave: WaveKind };
  geometry: { type: 'LineString'; coordinates: Position[] };
};
export type WaveFronts = { type: 'FeatureCollection'; features: WaveFront[] };

const FRONT_STEPS = 128;
const WAVES: ReadonlyArray<WaveKind> = ['p', 's'];

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
  const features = WAVES.flatMap((wave) => {
    const radiusKm = getWaveRadiusKm(seconds, depthKm, WAVE_SPEEDS_KM_S[wave]);
    return radiusKm > 0 ? [getWaveFront(epicenter, radiusKm, wave)] : [];
  });
  return { type: 'FeatureCollection', features };
}
