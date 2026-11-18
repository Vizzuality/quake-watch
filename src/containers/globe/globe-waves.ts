import { invalidate } from '@react-three/fiber';

import type { Earthquake } from '@/lib/earthquakes/types';

const ALL_QUAKES = 'all';
const NO_WAVE = -1;

export type GlobeWaveRequest = readonly string[] | typeof ALL_QUAKES;

export type GlobeWaves = {
  play: (ids?: readonly string[]) => void;
  pulse: (id: string) => void;
  takeRequests: () => GlobeWaveRequest[];
  takePulse: () => string | undefined;
};

export function createGlobeWaves(isReducedMotion: () => boolean): GlobeWaves {
  let requests: GlobeWaveRequest[] = [];
  let pulse: string | undefined;
  return {
    play: (ids) => {
      if (isReducedMotion()) return;
      requests.push(ids ?? ALL_QUAKES);
      invalidate();
    },
    pulse: (id) => {
      if (isReducedMotion()) return;
      pulse = id;
      invalidate();
    },
    takeRequests: () => {
      const taken = requests;
      requests = [];
      return taken;
    },
    takePulse: () => {
      const taken = pulse;
      pulse = undefined;
      return taken;
    },
  };
}

function getRequestedIds(
  request: GlobeWaveRequest,
  earthquakes: readonly Earthquake[],
): readonly string[] {
  if (request === ALL_QUAKES) return earthquakes.map(({ id }) => id);
  return request;
}

export function getWaveStarts(
  starts: ReadonlyMap<string, number>,
  requests: readonly GlobeWaveRequest[],
  earthquakes: readonly Earthquake[],
  time: number,
): Map<string, number> {
  const next = new Map(starts);
  for (const request of requests) {
    for (const id of getRequestedIds(request, earthquakes)) next.set(id, time);
  }
  return next;
}

export function getWaveStartValues(
  earthquakes: readonly Earthquake[],
  starts: ReadonlyMap<string, number>,
  verticesPerQuake = 1,
): Float32Array {
  return Float32Array.from({ length: earthquakes.length * verticesPerQuake }, (_, vertex) => {
    const { id } = earthquakes[Math.floor(vertex / verticesPerQuake)];
    return starts.get(id) ?? NO_WAVE;
  });
}
