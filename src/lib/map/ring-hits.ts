import { getDistanceKm } from '@/lib/earthquakes/distance';
import { getFeltReachKm, getIntensity } from '@/lib/earthquakes/intensity';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { S_WAVE_KM_S, getArrivalSeconds } from '@/lib/shakemap/wave';

import { getWaveFrontKm } from './shaking-waves';

export const RING_TOLERANCE_PX = 8;

export type RingHit = {
  earthquake: Earthquake;
  distanceKm: number;
  intensity: number;
  secondsSinceRuptureStart: number;
};

export function getRingHits({
  earthquakes,
  tMs,
  waveSpanMs,
  reducedMotion,
  cursor,
  kmPerPx,
  tolerancePx = RING_TOLERANCE_PX,
}: {
  earthquakes: Earthquake[];
  tMs: number;
  waveSpanMs: number;
  reducedMotion: boolean;
  cursor: SearchCenter;
  kmPerPx: number;
  tolerancePx?: number;
}): RingHit[] {
  const toleranceKm = tolerancePx * kmPerPx;
  return earthquakes
    .flatMap((earthquake) => {
      const { magnitude, depthKm } = earthquake;
      const feltReachKm = getFeltReachKm({ magnitude, depthKm });
      if (feltReachKm === 0) return [];
      const radiusKm = getWaveFrontKm({
        ageMs: tMs - earthquake.time,
        waveSpanMs,
        feltReachKm,
        depthKm,
        wave: 's',
        reducedMotion,
      });
      if (!radiusKm) return [];
      const distanceKm = getDistanceKm(earthquake, cursor);
      if (Math.abs(distanceKm - radiusKm) > toleranceKm) return [];
      const intensity = getIntensity({ magnitude, depthKm, distanceKm });
      const secondsSinceRuptureStart = getArrivalSeconds(distanceKm, depthKm, S_WAVE_KM_S);
      return [{ earthquake, distanceKm, intensity, secondsSinceRuptureStart }];
    })
    .sort((a, b) => b.intensity - a.intensity);
}
