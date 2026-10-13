export const FELT_INTENSITY = 2;

export const ALLEN_2012_RHYPO = {
  c0: 2.085,
  c1: 1.428,
  c2: -1.402,
  c4: 0.078,
  m1: -0.209,
  m2: 2.042,
  anelasticDistanceKm: 50,
} as const;
const MAX_REACH_KM = 20000;
const REACH_TOLERANCE_KM = 0.01;

export type IntensityRoman = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'IX' | 'X';

export type IntensityLevelKey =
  | 'not_felt'
  | 'weak'
  | 'light'
  | 'moderate'
  | 'strong'
  | 'very_strong'
  | 'severe'
  | 'violent'
  | 'extreme';

const ROMANS: ReadonlyArray<IntensityRoman> = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
];

const LEVEL_KEYS: Readonly<Record<IntensityRoman, IntensityLevelKey>> = {
  I: 'not_felt',
  II: 'weak',
  III: 'weak',
  IV: 'light',
  V: 'moderate',
  VI: 'strong',
  VII: 'very_strong',
  VIII: 'severe',
  IX: 'violent',
  X: 'extreme',
};

export function getIntensity({
  magnitude,
  depthKm,
  distanceKm,
}: {
  magnitude: number;
  depthKm: number;
  distanceKm: number;
}): number {
  const { c0, c1, c2, c4, m1, m2, anelasticDistanceKm } = ALLEN_2012_RHYPO;
  const rhypo = Math.hypot(distanceKm, depthKm);
  const rM = m1 + m2 * Math.exp(magnitude - 5);
  const anelastic = rhypo > anelasticDistanceKm ? c4 * Math.log(rhypo / anelasticDistanceKm) : 0;
  const distanceTerm = c2 * Math.log(Math.sqrt(rhypo ** 2 + rM ** 2)) + anelastic;
  return c0 + c1 * magnitude + distanceTerm;
}

export function getFeltReachKm({
  magnitude,
  depthKm,
}: {
  magnitude: number;
  depthKm: number;
}): number {
  if (!(getIntensity({ magnitude, depthKm, distanceKm: 0 }) >= FELT_INTENSITY)) {
    return 0;
  }
  let low = 0;
  let high = MAX_REACH_KM;
  while (high - low > REACH_TOLERANCE_KM) {
    const mid = (low + high) / 2;
    if (getIntensity({ magnitude, depthKm, distanceKm: mid }) > FELT_INTENSITY) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

export function getIntensityLevel(intensity: number): {
  roman: IntensityRoman;
  key: IntensityLevelKey;
} {
  if (Number.isNaN(intensity)) return { roman: 'I', key: 'not_felt' };
  const rounded = Math.min(10, Math.max(1, Math.floor(intensity + 0.5)));
  const roman = ROMANS[rounded - 1];
  return { roman, key: LEVEL_KEYS[roman] };
}
