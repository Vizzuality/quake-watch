import { getRadians } from '@/lib/earthquakes/distance';
import { FELT_INTENSITY, getFeltReachKm, getIntensity } from '@/lib/earthquakes/intensity';
import { PLAYBACK_DURATION_MS } from '@/lib/earthquakes/timeline';
import type { TimeRange } from '@/lib/earthquakes/timeline';
import type { Earthquake } from '@/lib/earthquakes/types';
import {
  S_WAVE_KM_S,
  WAVE_SPEEDS_KM_S,
  getRealSeconds,
  getWaveDurationSeconds,
  getWaveRadiusKm,
} from '@/lib/shakemap/wave';
import type { WaveKind } from '@/lib/shakemap/wave';

export const WAVE_DURATION_PLAYBACK_MS = 2_000;
export const WAVE_INSTANCE_STRIDE = 8;
export const WAVE_MIN_OPACITY = 0.15;
export const WAVE_FULL_OPACITY_STEPS = 4;
export const MAX_MERCATOR_LATITUDE = 85.051129;

export const WAVE_FRONT_STYLES: Readonly<
  Record<WaveKind, { readonly opacity: number; readonly bandHalfPx: number }>
> = {
  s: { opacity: 1, bandHalfPx: 1 },
  p: { opacity: 0.5, bandHalfPx: 0.5 },
};

export const WAVE_RAMP: ReadonlyArray<{ readonly intensity: number; readonly hex: string }> = [
  { intensity: 2, hex: '#9a3412' },
  { intensity: 3.5, hex: '#c2410c' },
  { intensity: 5, hex: '#ea580c' },
  { intensity: 6.5, hex: '#fb923c' },
  { intensity: 8, hex: '#fed7aa' },
];

export type WaveInstances = {
  originMs: number;
  data: Float32Array;
  count: number;
  stride: number;
};

export type Rgb = readonly [number, number, number];

export type WaveStyle = { radiusKm: number; intensity: number; opacity: number; color: Rgb };

export function getWaveSpanMs(playbackSpanMs: number): number {
  return (WAVE_DURATION_PLAYBACK_MS * playbackSpanMs) / PLAYBACK_DURATION_MS;
}

export function getPlaybackSpanMs(range: TimeRange, windowMs: number): number {
  const span = range.end - range.start;
  return span > 0 ? span : windowMs;
}

export function getMercatorX(longitude: number): number {
  return (180 + longitude) / 360;
}

export function getMercatorY(latitude: number): number {
  const clamped = Math.min(MAX_MERCATOR_LATITUDE, Math.max(-MAX_MERCATOR_LATITUDE, latitude));
  const y = Math.log(Math.tan(Math.PI / 4 + getRadians(clamped) / 2));
  return 0.5 - y / (2 * Math.PI);
}

export function getFloat32Split(value: number): readonly [number, number] {
  const high = Math.fround(value);
  return [high, Math.fround(value - high)];
}

export function getWaveInstances(earthquakes: Earthquake[], originMs: number): WaveInstances {
  const rows = earthquakes.flatMap(({ magnitude, depthKm, longitude, latitude, time }) => {
    const feltReachKm = getFeltReachKm({ magnitude, depthKm });
    if (feltReachKm === 0) return [];
    const [xHigh, xLow] = getFloat32Split(getMercatorX(longitude));
    const [yHigh, yLow] = getFloat32Split(getMercatorY(latitude));
    return [[xHigh, yHigh, xLow, yLow, (time - originMs) / 1000, feltReachKm, magnitude, depthKm]];
  });
  return {
    originMs,
    data: new Float32Array(rows.flat()),
    count: rows.length,
    stride: WAVE_INSTANCE_STRIDE,
  };
}

export function getWorldCopies(westLongitude: number, eastLongitude: number): number[] {
  // The shader lets each quad reach half a world past its copy.
  const first = Math.floor(getMercatorX(westLongitude)) - 1;
  const last = Math.floor(getMercatorX(eastLongitude)) + 1;
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

export function getTranslatedMatrix(matrix: ArrayLike<number>, x: number, y: number): Float32Array {
  const translated = Float32Array.from(matrix);
  for (let row = 0; row < 4; row += 1) {
    translated[12 + row] = matrix[row] * x + matrix[4 + row] * y + matrix[12 + row];
  }
  return translated;
}

type WaveLife = {
  ageMs: number;
  waveSpanMs: number;
  feltReachKm: number;
  depthKm: number;
};

export function getWaveSeconds({ ageMs, waveSpanMs, feltReachKm, depthKm }: WaveLife): number {
  return getRealSeconds(ageMs / waveSpanMs, getWaveDurationSeconds(feltReachKm, depthKm));
}

export function getWaveFrontKm(
  input: WaveLife & { wave: WaveKind; reducedMotion: boolean },
): number | null {
  const { ageMs, waveSpanMs, feltReachKm, depthKm, wave, reducedMotion } = input;
  const speedKmS = WAVE_SPEEDS_KM_S[wave];
  if (ageMs < 0 || ageMs > (waveSpanMs * S_WAVE_KM_S) / speedKmS) return null;
  if (reducedMotion) return wave === 's' ? feltReachKm : null;
  return getWaveRadiusKm(getWaveSeconds(input), depthKm, speedKmS);
}

export function getWaveOpacity(intensity: number): number {
  if (intensity < FELT_INTENSITY) return 0;
  const opacity = (intensity - FELT_INTENSITY) / WAVE_FULL_OPACITY_STEPS;
  return Math.min(1, Math.max(WAVE_MIN_OPACITY, opacity));
}

export function getWaveFade(input: { progress: number; reducedMotion: boolean }): number {
  return input.reducedMotion ? 1 - input.progress : 1;
}

export function getWaveIntensity(input: {
  magnitude: number;
  depthKm: number;
  radiusKm: number;
  reducedMotion: boolean;
}): number {
  const { magnitude, depthKm, radiusKm, reducedMotion } = input;
  const distanceKm = reducedMotion ? 0 : radiusKm;
  return Math.max(FELT_INTENSITY, getIntensity({ magnitude, depthKm, distanceKm }));
}

export function getWaveStyle(
  input: WaveLife & { wave: WaveKind; magnitude: number; reducedMotion: boolean },
): WaveStyle | null {
  const radiusKm = getWaveFrontKm(input);
  if (radiusKm === null) return null;
  const intensity = getWaveIntensity({ ...input, radiusKm });
  const fade = getWaveFade({ progress: input.ageMs / input.waveSpanMs, ...input });
  return {
    radiusKm,
    intensity,
    opacity: getWaveOpacity(intensity) * fade * WAVE_FRONT_STYLES[input.wave].opacity,
    color: getWaveColor(intensity),
  };
}

export function getRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function getWaveColor(intensity: number): Rgb {
  const first = WAVE_RAMP[0];
  const last = WAVE_RAMP[WAVE_RAMP.length - 1];
  if (intensity <= first.intensity) return getRgb(first.hex);
  const upperIndex = WAVE_RAMP.findIndex((stop) => stop.intensity >= intensity);
  if (upperIndex === -1) return getRgb(last.hex);
  const lower = WAVE_RAMP[upperIndex - 1];
  const upper = WAVE_RAMP[upperIndex];
  const weight = (intensity - lower.intensity) / (upper.intensity - lower.intensity);
  const from = getRgb(lower.hex);
  const to = getRgb(upper.hex);
  return [
    from[0] + (to[0] - from[0]) * weight,
    from[1] + (to[1] - from[1]) * weight,
    from[2] + (to[2] - from[2]) * weight,
  ];
}
