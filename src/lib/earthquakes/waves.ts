export const P_WAVE_KM_S = 6;
export const S_WAVE_KM_S = 4;

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

export const RIPPLE_LOOK = {
  reachBase: 0.06,
  reachAmp: 0.45,
  attack: 0.08,
  decayPower: 1.2,
  envelopeBase: 0.35,
  envelopeAmp: 0.65,
  frontPower: 0.8,
  minLambda: 0.09,
  lambdaK: 0.3,
} as const;

export type Ripple = {
  front: number;
  reach: number;
  lambda: number;
  envelope: number;
  minCos: number;
};

export function getRippleReach(amplitude: number, scale = 1): number {
  if (!(amplitude > 0)) return 0;
  return (RIPPLE_LOOK.reachBase + RIPPLE_LOOK.reachAmp * amplitude * amplitude) * scale;
}

function getRippleRise(progress: number): number {
  const { attack, decayPower } = RIPPLE_LOOK;
  if (progress < attack) return progress / attack;
  return Math.max(0, 1 - (progress - attack) / (1 - attack)) ** decayPower;
}

export function getRippleEnvelope(progress: number, k: number, amplitude: number): number {
  return (
    getRippleRise(progress) * k * (RIPPLE_LOOK.envelopeBase + RIPPLE_LOOK.envelopeAmp * amplitude)
  );
}

export function getRipple(
  amplitude: number,
  progress: number,
  k: number,
  scale = 1,
): Ripple | null {
  const reach = getRippleReach(amplitude, scale);
  if (reach <= 0 || !(progress > 0 && progress < 1)) return null;
  const lambda = Math.max(RIPPLE_LOOK.minLambda, reach * RIPPLE_LOOK.lambdaK);
  return {
    front: reach * progress ** RIPPLE_LOOK.frontPower,
    reach,
    lambda,
    envelope: getRippleEnvelope(progress, k, amplitude),
    minCos: Math.cos(Math.min(Math.PI, reach + lambda)),
  };
}

export function getWaveProgress(dataTime: number, quakeTime: number, lifeMs: number): number {
  return (dataTime - quakeTime) / lifeMs;
}
