import { getDepthRgb } from '../earthquakes/depth-color';
import { getFeltReachKm } from '../earthquakes/intensity';
import { getSequences } from '../earthquakes/sequences';
import type { Earthquake } from '../earthquakes/types';
import { type Ripple, getRipple, getWaveProgress } from '../earthquakes/waves';
import {
  EARTH_RADIUS_KM,
  getEpicentreRadiusPx,
  getHypocentreRadius,
  getQuakeAmplitude,
} from './quakes';
import { getLatLonVector } from './sphere';

export const FELT_RING_LOOK = {
  strokeA: 0.4,
  fillA: 0.094,
  hollowA: 0.7,
  hollowGapPx: 3,
  glowA: 0.5,
  glowBasePx: 6,
  glowAmpPx: 22,
  strokePx: 1,
} as const;

export const GLOBE_RING_LOOK = {
  selectedA: 0.7,
  fadedA: 0.1,
  fadeA: 0.3,
  fillK: 0.2,
  fillFullA: 0.85,
  growA: 0.85,
  growRate: 2.2,
  pulseBasePx: 3,
  pulseAmpPx: 20,
  pulseA: 0.8,
  pulsePx: 1.2,
  flashA: 0.7,
  backFlashK: 0.5,
  markRingGapPx: 7,
  markRingPx: 1.5,
  hoverA: 0.6,
  selectedMarkA: 0.95,
} as const;

export const MAX_GLOBE_WAVES = 32;
export const REPLAY_LIFE_K = 1.4;
export const AFTERSHOCK_WAVE = { k: 0.4, ratioBase: 0.3, scale: 0.7 } as const;
const HOUR_MS = 3_600_000;
const WAVE_BASE_SECONDS = 1.4;
const WAVE_AMP_SECONDS = 2.6;
const MAX_WAVE_SECONDS = WAVE_BASE_SECONDS + WAVE_AMP_SECONDS;

export type WaveQuake = {
  time: number;
  amplitude: number;
  lifeSeconds: number;
  isFelt: boolean;
  mainIndex: number;
};

export type GlobeWave = Ripple & { index: number };

export type WallWave = { index: number; progress: number; k: number };

const NO_WAVES: readonly GlobeWave[] = [];

export type FeltRingAttributes = {
  direction: Float32Array;
  radius: Float32Array;
  color: Float32Array;
  shape: Float32Array;
  state: Float32Array;
};

export function getFeltRingAngle(magnitude: number, depthKm: number): number {
  return getFeltReachKm({ magnitude, depthKm }) / EARTH_RADIUS_KM;
}

export function getMinRingRadiusPx(magnitude: number): number {
  return getEpicentreRadiusPx(magnitude) + FELT_RING_LOOK.hollowGapPx;
}

export function getWaveLifeSeconds(magnitude: number): number {
  return WAVE_BASE_SECONDS + WAVE_AMP_SECONDS * getQuakeAmplitude(magnitude);
}

export function getReplaySeconds(magnitude: number): number {
  return getWaveLifeSeconds(magnitude) * REPLAY_LIFE_K;
}

export function getWavesEndTime(
  earthquakes: readonly Earthquake[],
  waveStarts: ReadonlyMap<string, number>,
): number {
  let end = -Infinity;
  for (const { id, magnitude } of earthquakes) {
    const start = waveStarts.get(id);
    if (start !== undefined) end = Math.max(end, start + getReplaySeconds(magnitude));
  }
  return end;
}

export function getPrunedWaveStarts(
  earthquakes: readonly Earthquake[],
  waveStarts: ReadonlyMap<string, number>,
  time: number,
): Map<string, number> {
  const pruned = new Map<string, number>();
  for (const { id, magnitude } of earthquakes) {
    const start = waveStarts.get(id);
    if (start !== undefined && time <= start + getReplaySeconds(magnitude)) pruned.set(id, start);
  }
  return pruned;
}

export function getGlowRadiusPx(magnitude: number): number {
  return FELT_RING_LOOK.glowBasePx + FELT_RING_LOOK.glowAmpPx * getQuakeAmplitude(magnitude);
}

export function isFeltRingShown(earthquake: Earthquake, selected: Earthquake | undefined): boolean {
  return selected === undefined || earthquake === selected;
}

function getShownReachAngle(earthquake: Earthquake, selected: Earthquake | undefined): number {
  if (!isFeltRingShown(earthquake, selected)) return 0;
  return getFeltRingAngle(earthquake.magnitude, earthquake.depthKm);
}

export function getQuakeStates(
  earthquakes: readonly Earthquake[],
  originMs: number,
  verticesPerQuake = 1,
): Float32Array {
  const states = new Float32Array(earthquakes.length * verticesPerQuake * 3);
  earthquakes.forEach(({ time, magnitude }, index) => {
    const state = [(time - originMs) / HOUR_MS, getWaveLifeSeconds(magnitude), index];
    for (let vertex = 0; vertex < verticesPerQuake; vertex++) {
      states.set(state, (index * verticesPerQuake + vertex) * 3);
    }
  });
  return states;
}

export function getFeltRingAttributes(
  earthquakes: readonly Earthquake[],
  selected?: Earthquake,
  originMs = 0,
): FeltRingAttributes {
  const count = earthquakes.length;
  const attributes: FeltRingAttributes = {
    direction: new Float32Array(count * 3),
    radius: new Float32Array(count),
    color: new Float32Array(count * 3),
    shape: new Float32Array(count * 3),
    state: getQuakeStates(earthquakes, originMs),
  };

  earthquakes.forEach((earthquake, index) => {
    const { latitude, longitude, magnitude, depthKm } = earthquake;
    attributes.direction.set(getLatLonVector(latitude, longitude), index * 3);
    attributes.radius[index] = getHypocentreRadius(depthKm);
    attributes.color.set(
      getDepthRgb(depthKm).map((channel) => channel / 255),
      index * 3,
    );
    const isFelt = getFeltRingAngle(magnitude, depthKm) > 0 ? 1 : 0;
    attributes.shape.set(
      [getQuakeAmplitude(magnitude), getShownReachAngle(earthquake, selected), isFelt],
      index * 3,
    );
  });

  return attributes;
}

export function getWaveQuakes(sorted: readonly Earthquake[]): WaveQuake[] {
  const indexOf = new Map(sorted.map((earthquake, index) => [earthquake, index]));
  const mainIndex = new Map<Earthquake, number>();
  for (const { main, members } of getSequences(sorted)) {
    for (const { earthquake } of members) {
      if (earthquake !== main) mainIndex.set(earthquake, indexOf.get(main) ?? -1);
    }
  }
  return sorted.map((earthquake) => ({
    time: earthquake.time,
    amplitude: getQuakeAmplitude(earthquake.magnitude),
    lifeSeconds: getWaveLifeSeconds(earthquake.magnitude),
    isFelt: getFeltRingAngle(earthquake.magnitude, earthquake.depthKm) > 0,
    mainIndex: mainIndex.get(earthquake) ?? -1,
  }));
}

function getAftershockK(amplitude: number, mainAmplitude: number): number {
  return AFTERSHOCK_WAVE.k * Math.min(1, amplitude / mainAmplitude + AFTERSHOCK_WAVE.ratioBase);
}

function getStrength({ envelope, reach }: GlobeWave): number {
  return envelope * reach;
}

export function getGlobeWaves({
  quakes,
  shownCount,
  dataTime,
  lifeMsPerSecond,
  wallWaves,
}: {
  quakes: readonly WaveQuake[];
  shownCount: number;
  dataTime: number | null;
  lifeMsPerSecond: number;
  wallWaves: readonly WallWave[];
}): readonly GlobeWave[] {
  if (dataTime === null && wallWaves.length === 0) return NO_WAVES;
  const waves: GlobeWave[] = [];
  function push(index: number, ripple: Ripple | null) {
    if (ripple) waves.push({ ...ripple, index });
  }
  for (const { index, progress, k } of wallWaves) {
    const quake = quakes[index];
    if (quake?.isFelt) push(index, getRipple(quake.amplitude, progress, k));
  }
  const oldest = (dataTime ?? 0) - MAX_WAVE_SECONDS * lifeMsPerSecond;
  for (let index = shownCount - 1; dataTime !== null && index >= 0; index--) {
    const quake = quakes[index];
    if (quake.time < oldest) break;
    if (!quake.isFelt || wallWaves.some((wave) => wave.index === index)) continue;
    const progress = getWaveProgress(dataTime, quake.time, quake.lifeSeconds * lifeMsPerSecond);
    push(index, getRipple(quake.amplitude, progress, 1));
    const main = quakes[quake.mainIndex];
    if (!main?.isFelt || main.time > quake.time) continue;
    const k = getAftershockK(quake.amplitude, main.amplitude);
    push(quake.mainIndex, getRipple(main.amplitude, progress, k, AFTERSHOCK_WAVE.scale));
  }
  waves.sort((a, b) => getStrength(b) - getStrength(a));
  waves.length = Math.min(waves.length, MAX_GLOBE_WAVES);
  return waves;
}
