import { describe, expect, it } from 'vitest';

import { getFeltReachKm } from '@/lib/earthquakes/intensity';
import type { Earthquake } from '@/lib/earthquakes/types';
import { S_WAVE_KM_S, getArrivalSeconds } from '@/lib/shakemap/wave';

import { getRingHits } from './ring-hits';
import { getWaveFrontKm } from './shaking-waves';

const KM_PER_DEGREE = 111.195;
const SPAN_MS = 1000;

function getQuake(overrides: Partial<Earthquake> = {}): Earthquake {
  return {
    id: 'a',
    source: 'usgs',
    magnitude: 6,
    magnitudeType: 'mww',
    place: null,
    time: 0,
    depthKm: 10,
    latitude: 0,
    longitude: 0,
    url: '',
    ...overrides,
  };
}

function getCursorAtKm(km: number) {
  return { latitude: 0, longitude: km / KM_PER_DEGREE };
}

const REACH = getFeltReachKm({ magnitude: 6, depthKm: 10 });
const FRONT_KM =
  getWaveFrontKm({
    ageMs: SPAN_MS / 2,
    waveSpanMs: SPAN_MS,
    feltReachKm: REACH,
    depthKm: 10,
    wave: 's',
    reducedMotion: false,
  }) ?? 0;

function getHits(overrides: Partial<Parameters<typeof getRingHits>[0]> = {}) {
  return getRingHits({
    earthquakes: [getQuake()],
    tMs: SPAN_MS / 2,
    waveSpanMs: SPAN_MS,
    reducedMotion: false,
    cursor: getCursorAtKm(FRONT_KM),
    kmPerPx: 1,
    ...overrides,
  });
}

describe('getRingHits', () => {
  it('hits when the cursor sits on the live S front', () => {
    const [hit] = getHits();
    expect(hit.earthquake.id).toBe('a');
    expect(hit.distanceKm).toBeCloseTo(FRONT_KM, 0);
  });

  it('gives the real seconds since the rupture start for the S wave to reach the cursor', () => {
    const [hit] = getHits();
    expect(hit.secondsSinceRuptureStart).toBeCloseTo(
      getArrivalSeconds(hit.distanceKm, 10, S_WAVE_KM_S),
      10,
    );
    expect(hit.secondsSinceRuptureStart).toBeCloseTo(
      getArrivalSeconds(REACH, 10, S_WAVE_KM_S) / 2,
      0,
    );
  });

  it('misses at the Epicenter before the S front reaches the surface', () => {
    const deep = getQuake({ depthKm: 60 });
    expect(getFeltReachKm(deep)).toBeGreaterThan(0);
    expect(getHits({ earthquakes: [deep], tMs: 1, cursor: getCursorAtKm(0) })).toHaveLength(0);
  });

  it('misses beyond the tolerance and hits within it', () => {
    expect(getHits({ cursor: getCursorAtKm(FRONT_KM + 9) })).toHaveLength(0);
    expect(getHits({ cursor: getCursorAtKm(FRONT_KM + 7) })).toHaveLength(1);
  });

  it('scales the tolerance with the kilometres per pixel and a custom tolerance', () => {
    expect(getHits({ cursor: getCursorAtKm(FRONT_KM + 9), kmPerPx: 2 })).toHaveLength(1);
    expect(getHits({ cursor: getCursorAtKm(FRONT_KM + 9), tolerancePx: 10 })).toHaveLength(1);
  });

  it('ignores earthquakes after t and waves that are no longer alive', () => {
    expect(getHits({ earthquakes: [getQuake({ time: SPAN_MS })] })).toHaveLength(0);
    expect(getHits({ tMs: SPAN_MS * 2 })).toHaveLength(0);
  });

  it('ignores earthquakes too small to be felt', () => {
    const quake = getQuake({ magnitude: 0.5 });
    expect(getHits({ earthquakes: [quake], cursor: getCursorAtKm(0) })).toHaveLength(0);
  });

  it('uses the Felt reach as the radius under reduced motion', () => {
    const cursor = getCursorAtKm(REACH);
    expect(getHits({ cursor })).toHaveLength(0);
    expect(getHits({ cursor, reducedMotion: true })).toHaveLength(1);
  });

  it('sorts hits by Intensity at the cursor, highest first', () => {
    const weak = getQuake({ id: 'weak', magnitude: 5 });
    const strong = getQuake({ id: 'strong', magnitude: 7 });
    const hits = getHits({
      earthquakes: [weak, strong],
      reducedMotion: true,
      cursor: getCursorAtKm(getFeltReachKm({ magnitude: 5, depthKm: 10 })),
      kmPerPx: 1000,
    });
    expect(hits.map((hit) => hit.earthquake.id)).toEqual(['strong', 'weak']);
    expect(hits[0].intensity).toBeGreaterThan(hits[1].intensity);
  });
});
