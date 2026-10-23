export const P_WAVE_KM_S = 6;
export const S_WAVE_KM_S = 4;
export type WaveKind = 'p' | 's';
export const WAVE_SPEEDS_KM_S: Readonly<Record<WaveKind, number>> = {
  p: P_WAVE_KM_S,
  s: S_WAVE_KM_S,
};

export function getArrivalSeconds(distanceKm: number, depthKm: number, speedKmS: number): number {
  return Math.hypot(distanceKm, depthKm) / speedKmS;
}

export function getWaveDurationSeconds(maxReachKm: number, depthKm: number): number {
  return getArrivalSeconds(maxReachKm, depthKm, S_WAVE_KM_S);
}

export function getRealSeconds(progress: number, durationSeconds: number): number {
  if (Number.isNaN(progress)) return 0;
  return Math.min(1, Math.max(0, progress)) * durationSeconds;
}

export function getWaveRadiusKm(seconds: number, depthKm: number, speedKmS: number): number {
  const slantKm = Math.max(0, seconds) * speedKmS;
  return Math.sqrt(Math.max(0, slantKm ** 2 - depthKm ** 2));
}
