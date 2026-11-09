export const GLOBE_DOT_COUNT = 30_000;

export const GLOBE_BACKGROUND = '#05050B';

export const GLOBE_LOOK = {
  ocean: [63, 127, 217],
  oceanA: 1,
  land: [124, 214, 178],
  landA: 0.25,
  landS: 0.9,
  dot: 0.7,
  rim: 1,
  outA: 0.15,
  outW: 0.5,
  veil: 0.7,
  backK: 0.75,
} as const;

export const GLOBE_GLOW = {
  from: 0.92,
  to: 1.28,
  rgb: [90, 100, 255],
  alpha: 0.1,
} as const;
