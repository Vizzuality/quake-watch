import { getDistanceKm } from '@/lib/earthquakes/distance';
import type { SearchCenter } from '@/lib/earthquakes/search-schema';

import { getGridMmi } from './coverage';
import type { ShakemapGrid } from './coverage';
import { S_WAVE_KM_S, getArrivalSeconds } from './wave';

export type ShakemapReveal = {
  epicenter: SearchCenter;
  depthKm: number;
  seconds: number;
  complete: boolean;
};

export function getShakemapReveal(
  epicenter: SearchCenter,
  depthKm: number,
  seconds: number,
  complete: boolean,
): ShakemapReveal {
  return { epicenter, depthKm, seconds, complete };
}

export function getRevealedMmi(
  grid: ShakemapGrid,
  reveal: ShakemapReveal,
  point: SearchCenter,
): number | null {
  const mmi = getGridMmi(grid, point.longitude, point.latitude);
  if (mmi === null) return null;
  if (reveal.complete) return mmi;
  const arrival = getArrivalSeconds(
    getDistanceKm(reveal.epicenter, point),
    reveal.depthKm,
    S_WAVE_KM_S,
  );
  return arrival <= reveal.seconds ? mmi : null;
}
