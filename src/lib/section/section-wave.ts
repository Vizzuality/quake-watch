export const SECTION_WAVE = {
  periodMs: 3200,
  minRadius: 7,
  maxRadius: 200,
  peakOpacity: 0.55,
} as const;

export type WaveRing = { radius: number; opacity: number };

export function getWaveRing(elapsedMs: number, index: number, count: number): WaveRing {
  const progress = (((elapsedMs / SECTION_WAVE.periodMs + index / count) % 1) + 1) % 1;
  const { minRadius, maxRadius, peakOpacity } = SECTION_WAVE;
  return {
    radius: minRadius + (maxRadius - minRadius) * progress,
    opacity: peakOpacity * (1 - progress) ** 1.5,
  };
}
