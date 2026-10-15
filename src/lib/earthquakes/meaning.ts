import { getFeltReachKm, getIntensity, getIntensityLevel } from './intensity';
import type { IntensityLevelKey, IntensityRoman } from './intensity';

export type EarthquakeMeaning =
  | { kind: 'felt-reach'; reachKm: number }
  | { kind: 'not-felt' }
  | { kind: 'at-place'; roman: IntensityRoman; key: IntensityLevelKey };

export function getRoundedReachKm(reachKm: number): number {
  if (reachKm < 10) return Math.max(1, Math.round(reachKm));
  const magnitude = 10 ** (Math.floor(Math.log10(reachKm)) - 1);
  return Math.round(reachKm / magnitude) * magnitude;
}

export function getEarthquakeMeaning({
  magnitude,
  depthKm,
  distanceKm,
}: {
  magnitude: number;
  depthKm: number;
  distanceKm: number | null;
}): EarthquakeMeaning {
  if (distanceKm !== null) {
    return {
      kind: 'at-place',
      ...getIntensityLevel(getIntensity({ magnitude, depthKm, distanceKm })),
    };
  }
  const reachKm = getFeltReachKm({ magnitude, depthKm });
  if (reachKm < 1) return { kind: 'not-felt' };
  return { kind: 'felt-reach', reachKm: getRoundedReachKm(reachKm) };
}
