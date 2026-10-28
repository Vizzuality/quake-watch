export const DRUM_TILE_WIDTH = 800;

const STEP = 4;
const NOISE = 0.6;
const BURST_CHANCE = 0.025;
const BURST_MIN_STEPS = 6;
const BURST_EXTRA_STEPS = 10;
const BURST_MIN_AMPLITUDE = 2;
const BURST_EXTRA_AMPLITUDE = 4;
const SEAM_STEPS = BURST_MIN_STEPS + BURST_EXTRA_STEPS;

type Burst = { remaining: number; length: number; amplitude: number };

export function getSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function getBurst(random: () => number): Burst {
  const length = BURST_MIN_STEPS + Math.floor(random() * BURST_EXTRA_STEPS);
  return {
    remaining: length,
    length,
    amplitude: BURST_MIN_AMPLITUDE + random() * BURST_EXTRA_AMPLITUDE,
  };
}

function getBurstOffset({ remaining, length, amplitude }: Burst): number {
  const sign = remaining % 2 === 0 ? 1 : -1;
  return sign * amplitude * (remaining / length);
}

export function getRowPoints({ y, random }: { y: number; random: () => number }): string {
  const steps = DRUM_TILE_WIDTH / STEP;
  const points = [`0,${y}`];
  let burst: Burst | null = null;

  for (let step = 1; step < steps; step++) {
    if (!burst && step < steps - SEAM_STEPS && random() < BURST_CHANCE) burst = getBurst(random);
    const noise = (random() * 2 - 1) * NOISE;
    const offset = burst ? getBurstOffset(burst) : noise;
    if (burst) burst = burst.remaining > 1 ? { ...burst, remaining: burst.remaining - 1 } : null;
    points.push(`${step * STEP},${Math.round((y + offset) * 10) / 10}`);
  }

  points.push(`${DRUM_TILE_WIDTH},${y}`);
  return points.join(' ');
}
