import { getDistanceKm } from '@/lib/earthquakes/distance';
import { getFeltReachKm, getIntensity } from '@/lib/earthquakes/intensity';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';

import { getWaveRadiusKm } from './shaking-waves';

export const RING_TOLERANCE_PX = 8;

export type RingHit = { earthquake: Earthquake; distanceKm: number; intensity: number };

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
      const radiusKm = getWaveRadiusKm({
        ageMs: tMs - earthquake.time,
        waveSpanMs,
        feltReachKm,
        reducedMotion,
      });
      if (radiusKm === null) return [];
      const distanceKm = getDistanceKm(earthquake, cursor);
      if (Math.abs(distanceKm - radiusKm) > toleranceKm) return [];
      const intensity = getIntensity({ magnitude, depthKm, distanceKm });
      return [{ earthquake, distanceKm, intensity }];
    })
    .sort((a, b) => b.intensity - a.intensity);
}
