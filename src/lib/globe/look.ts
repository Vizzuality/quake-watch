export const GLOBE_DOT_COUNT = 30_000;

export const GLOBE_LOOK = {
  ocean: [63, 127, 217],
  oceanA: 1,
  land: [124, 214, 178],
  landA: 0.25,
  landS: 0.9,
  dot: 0.7,
  rim: 1,
  backFace: 0.18,
  veil: [24, 26, 54],
  veilA: 0.7,
  halo: [90, 100, 255],
  haloA: 0.1,
  haloFrom: 0.92,
  haloTo: 1.28,
  coastA: 0.15,
  coastPx: 0.5,
} as const;

export function getCoastAlpha(dpr: number): number {
  return GLOBE_LOOK.coastA * Math.min(1, GLOBE_LOOK.coastPx * dpr);
}
