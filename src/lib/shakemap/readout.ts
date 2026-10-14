import type { SearchCenter } from '@/lib/earthquakes/search-schema';

import { getGridMmi } from './coverage';
import type { ShakemapGrid } from './coverage';
import { getIsInsideReveal, getRevealRadiusKm } from './reveal';

export type ShakemapReveal = { epicenter: SearchCenter; radiusKm: number; complete: boolean };

export function getShakemapReveal(
  epicenter: SearchCenter,
  progress: number,
  maxReachKm: number,
): ShakemapReveal {
  return {
    epicenter,
    radiusKm: getRevealRadiusKm(progress, maxReachKm),
    complete: progress >= 1,
  };
}

export function getRevealedMmi(
  grid: ShakemapGrid,
  reveal: ShakemapReveal,
  point: SearchCenter,
): number | null {
  const mmi = getGridMmi(grid, point.longitude, point.latitude);
  if (mmi === null) return null;
  if (!reveal.complete && !getIsInsideReveal(reveal.epicenter, point, reveal.radiusKm)) return null;
  return mmi;
}
