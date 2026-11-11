import { invalidate } from '@react-three/fiber';

import type { Earthquake } from '@/lib/earthquakes/types';

import { REDUCED_MOTION_QUERY } from './use-globe-controls';

const ALL_QUAKES = 'all';
const NO_WAVE = -1;

export type GlobeWaveRequest = readonly string[] | typeof ALL_QUAKES;

export type GlobeWaves = {
  play: (ids?: readonly string[]) => void;
  takeRequests: () => GlobeWaveRequest[];
};

export function createGlobeWaves(): GlobeWaves {
  let requests: GlobeWaveRequest[] = [];
  return {
    play: (ids) => {
      if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
      requests.push(ids ?? ALL_QUAKES);
      invalidate();
    },
    takeRequests: () => {
      const taken = requests;
      requests = [];
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
): Float32Array {
  return Float32Array.from(earthquakes, ({ id }) => starts.get(id) ?? NO_WAVE);
}
