export const P_WAVE_KM_S = 6;
export const S_WAVE_KM_S = 4;
export type WaveKind = 'p' | 's';
export const WAVE_SPEEDS_KM_S: Readonly<Record<WaveKind, number>> = {
  p: P_WAVE_KM_S,
  s: S_WAVE_KM_S,
};
export const WAVE_SCREEN_MS = 7_000;

export const MAX_MMI = 10;
export const MIN_AMPLITUDE = 0.35;
export const AMPLITUDE_RANGE = 1 - MIN_AMPLITUDE;
export const MIN_RISE_SECONDS = 1;
export const RISE_RANGE_SECONDS = 2;
export const MIN_DECAY_SECONDS = 4;
export const DECAY_RANGE_SECONDS = 16;

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

function getPulseStrength(mmi: number): number {
  return Number.isFinite(mmi) ? Math.min(1, Math.max(0, mmi / MAX_MMI)) : 0;
}

function getPulseRiseSeconds(strength: number): number {
  return MIN_RISE_SECONDS + RISE_RANGE_SECONDS * strength;
}

function getPulseDecaySeconds(strength: number): number {
  return MIN_DECAY_SECONDS + DECAY_RANGE_SECONDS * strength;
}

export function getPulseLengthSeconds(mmi: number): number {
  const strength = getPulseStrength(mmi);
  return getPulseRiseSeconds(strength) + getPulseDecaySeconds(strength);
}

export function getPulse(secondsSinceS: number, mmi: number): number {
  if (!(secondsSinceS > 0)) return 0;
  const strength = getPulseStrength(mmi);
  const amplitude = MIN_AMPLITUDE + AMPLITUDE_RANGE * strength;
  const rise = getPulseRiseSeconds(strength);
  const decay = getPulseDecaySeconds(strength);
  if (secondsSinceS < rise) return amplitude * Math.sin((Math.PI / 2) * (secondsSinceS / rise));
  if (secondsSinceS >= rise + decay) return 0;
  return amplitude * 0.5 * (1 + Math.cos((Math.PI * (secondsSinceS - rise)) / decay));
}

export function getArrivedCount(sortedArrivals: ArrayLike<number>, seconds: number): number {
  let low = 0;
  let high = sortedArrivals.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (sortedArrivals[middle] <= seconds) low = middle + 1;
    else high = middle;
  }
  return low;
}
