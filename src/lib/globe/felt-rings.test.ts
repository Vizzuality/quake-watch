import { describe, expect, it } from 'vitest';

import { getDepthRgb } from '../earthquakes/depth-color';
import { getFeltReachKm } from '../earthquakes/intensity';
import type { Earthquake } from '../earthquakes/types';
import { getRipple } from '../earthquakes/waves';
import {
  FELT_RING_LOOK,
  MAX_GLOBE_WAVES,
  type WaveQuake,
  getFeltRingAngle,
  getFeltRingAttributes,
  getGlobeWaves,
  getMinRingRadiusPx,
  getPrunedWaveStarts,
  getQuakeStates,
  getReplaySeconds,
  getWaveLifeSeconds,
  getWaveQuakes,
  getWavesEndTime,
  isFeltRingShown,
} from './felt-rings';
import { EARTH_RADIUS_KM, getHypocentreRadius, getQuakeAmplitude } from './quakes';
import { getLatLonVector } from './sphere';

const HOUR_MS = 3_600_000;

function getEarthquake(overrides: Partial<Earthquake>): Earthquake {
  return {
    id: 'q',
    source: 'usgs',
    magnitude: 5,
    magnitudeType: 'mw',
    place: null,
    time: 0,
    depthKm: 10,
    longitude: 0,
    latitude: 0,
    url: 'https://example.com',
    ...overrides,
  };
}

function getWaveQuake(overrides: Partial<WaveQuake>): WaveQuake {
  return { time: 0, amplitude: 0.5, lifeSeconds: 2, isFelt: true, mainIndex: -1, ...overrides };
}

describe('FELT_RING_LOOK', () => {
  it('pins the prototype look', () => {
    expect(FELT_RING_LOOK).toEqual({
      strokeA: 0.4,
      fillA: 0.094,
      hollowA: 0.7,
      hollowGapPx: 3,
      glowA: 0.5,
      glowBasePx: 6,
      glowAmpPx: 22,
      strokePx: 1,
    });
  });
});

describe('getFeltRingAngle', () => {
  it('turns the Felt reach of a shallow M5 into an angle on the globe', () => {
    const reachKm = getFeltReachKm({ magnitude: 5, depthKm: 10 });
    expect(reachKm).toBeGreaterThan(184);
    expect(reachKm).toBeLessThan(188);
    expect(getFeltRingAngle(5, 10)).toBeCloseTo(reachKm / EARTH_RADIUS_KM, 6);
  });

  it('is 0 for a deep M4 nobody feels', () => {
    expect(getFeltRingAngle(4, 500)).toBe(0);
  });
});

describe('getMinRingRadiusPx', () => {
  it.each([
    [3, 3.9],
    [6, 4.65],
  ])('keeps M%i at least %f px, the epicentre radius plus the gap', (magnitude, px) => {
    expect(getMinRingRadiusPx(magnitude)).toBeCloseTo(px, 6);
  });
});

describe('getWaveLifeSeconds', () => {
  it.each([
    [2, 1.712],
    [6.4, 4],
    [9, 4],
  ])('lasts M%f %f s', (magnitude, seconds) => {
    expect(getWaveLifeSeconds(magnitude)).toBeCloseTo(seconds, 6);
  });

  it('replays over 1.4 × the life', () => {
    expect(getReplaySeconds(9)).toBeCloseTo(5.6, 9);
  });
});

describe('getPrunedWaveStarts', () => {
  const m5 = getEarthquake({ id: 'm5', magnitude: 5, depthKm: 10 });
  const m7 = getEarthquake({ id: 'm7', magnitude: 7, depthKm: 10 });
  const unfelt = getEarthquake({ id: 'unfelt', magnitude: 4, depthKm: 500 });

  it('keeps running replays, felt or not, and drops finished and unknown ones', () => {
    const starts = new Map([
      ['m5', 0],
      ['m7', 0],
      ['unfelt', 0],
      ['gone', 0],
    ]);
    const time = getReplaySeconds(5) + 0.1;

    expect(getReplaySeconds(7)).toBeGreaterThan(time);
    expect(getReplaySeconds(4)).toBeLessThan(time);
    expect(getPrunedWaveStarts([m5, m7, unfelt], starts, time)).toEqual(new Map([['m7', 0]]));
    expect(getPrunedWaveStarts([unfelt], starts, 0.1)).toEqual(new Map([['unfelt', 0]]));
  });

  it('keeps a replay on its last frame', () => {
    const starts = new Map([['m5', 2]]);

    expect(getPrunedWaveStarts([m5], starts, 2 + getReplaySeconds(5))).toEqual(starts);
  });
});

describe('getWavesEndTime', () => {
  const m5 = getEarthquake({ id: 'm5', magnitude: 5, depthKm: 10 });
  const m7 = getEarthquake({ id: 'm7', magnitude: 7, depthKm: 10 });

  it('ends when the last started replay ends', () => {
    const starts = new Map([
      ['m5', 10],
      ['m7', 9],
    ]);
    const end = Math.max(10 + getReplaySeconds(5), 9 + getReplaySeconds(7));

    expect(getWavesEndTime([m5, m7], starts)).toBeCloseTo(end, 9);
  });

  it('ignores starts of quakes no longer shown', () => {
    expect(getWavesEndTime([m5], new Map([['gone', 100]]))).toBe(-Infinity);
  });

  it('has no end before any replay starts', () => {
    expect(getWavesEndTime([m5, m7], new Map())).toBe(-Infinity);
    expect(getWavesEndTime([], new Map())).toBe(-Infinity);
  });
});

describe('isFeltRingShown', () => {
  it('shows every felt ring without a selection and only the selected one with it', () => {
    const selected = getEarthquake({ id: 'a' });
    const other = getEarthquake({ id: 'b' });

    expect(isFeltRingShown(other, undefined)).toBe(true);
    expect(isFeltRingShown(selected, selected)).toBe(true);
    expect(isFeltRingShown(other, selected)).toBe(false);
  });
});

describe('getQuakeStates', () => {
  it('packs hours since the origin, wave life and index for every vertex', () => {
    const states = getQuakeStates(
      [getEarthquake({ time: 2 * HOUR_MS, magnitude: 9 }), getEarthquake({ time: 5 * HOUR_MS })],
      HOUR_MS,
      2,
    );

    expect(Array.from(states)).toEqual([
      1,
      4,
      0,
      1,
      4,
      0,
      4,
      Math.fround(getWaveLifeSeconds(5)),
      1,
      4,
      Math.fround(getWaveLifeSeconds(5)),
      1,
    ]);
  });
});

describe('getFeltRingAttributes', () => {
  it('packs one instance per Earthquake, felt or not', () => {
    const felt = getEarthquake({ id: 'a', magnitude: 5, depthKm: 10, latitude: 10, longitude: 20 });
    const hollow = getEarthquake({ id: 'b', magnitude: 4, depthKm: 500, latitude: -30 });
    const attributes = getFeltRingAttributes([felt, hollow]);

    expect(attributes.direction).toHaveLength(6);
    expect(attributes.shape).toHaveLength(6);
    expect(attributes.state).toHaveLength(6);

    const direction = getLatLonVector(10, 20);
    for (const [axis, value] of direction.entries()) {
      expect(attributes.direction[axis]).toBeCloseTo(value, 6);
    }
    expect(attributes.radius[1]).toBeCloseTo(getHypocentreRadius(500), 6);
    expect(attributes.shape[0]).toBeCloseTo(getQuakeAmplitude(5), 6);
    expect(attributes.shape[1]).toBeCloseTo(getFeltRingAngle(5, 10), 6);
    expect(attributes.shape[2]).toBe(1);
    expect(Array.from(attributes.shape.subarray(4))).toEqual([0, 0]);
    const [r, g, b] = getDepthRgb(500);
    expect(attributes.color[3]).toBeCloseTo(r / 255, 6);
    expect(attributes.color[4]).toBeCloseTo(g / 255, 6);
    expect(attributes.color[5]).toBeCloseTo(b / 255, 6);
  });

  it('keeps only the selected Earthquake felt ring and still marks the others felt', () => {
    const selected = getEarthquake({ id: 'a', magnitude: 5, depthKm: 10 });
    const other = getEarthquake({ id: 'b', magnitude: 6, depthKm: 10 });
    const attributes = getFeltRingAttributes([selected, other], selected);

    expect(attributes.shape[1]).toBeCloseTo(getFeltRingAngle(5, 10), 6);
    expect(attributes.shape[4]).toBe(0);
    expect(attributes.shape[5]).toBe(1);
  });

  it('returns empty arrays for no quakes', () => {
    expect(getFeltRingAttributes([]).shape).toHaveLength(0);
  });
});

describe('getWaveQuakes', () => {
  it('links each aftershock to its mainshock and flags who is felt', () => {
    const main = getEarthquake({ id: 'main', magnitude: 6, time: 0 });
    const after = getEarthquake({ id: 'after', magnitude: 4, time: HOUR_MS, latitude: 0.1 });
    const far = getEarthquake({
      id: 'far',
      magnitude: 4,
      depthKm: 500,
      time: 2 * HOUR_MS,
      latitude: 60,
    });
    const quakes = getWaveQuakes([main, after, far]);

    expect(quakes.map(({ mainIndex }) => mainIndex)).toEqual([-1, 0, -1]);
    expect(quakes.map(({ isFelt }) => isFelt)).toEqual([true, true, false]);
    expect(quakes[0].amplitude).toBeCloseTo(getQuakeAmplitude(6), 9);
    expect(quakes[0].lifeSeconds).toBeCloseTo(getWaveLifeSeconds(6), 9);
  });
});

describe('getGlobeWaves', () => {
  const lifeMsPerSecond = HOUR_MS;

  function getWaves(quakes: WaveQuake[], dataTime: number | null, wallWaves = []) {
    return getGlobeWaves({
      quakes,
      shownCount: quakes.length,
      dataTime,
      lifeMsPerSecond,
      wallWaves,
    });
  }

  it('ripples a felt Earthquake at its progress in data time, so a paused playhead freezes it', () => {
    const quake = getWaveQuake({ time: HOUR_MS, lifeSeconds: 2 });

    expect(getWaves([quake], 1.5 * HOUR_MS)).toEqual([{ ...getRipple(0.5, 0.25, 1), index: 0 }]);
  });

  it.each([
    ['before it happens', 0.5],
    ['after its life', 3.5],
  ])('has no ripple %s', (_, hours) => {
    expect(getWaves([getWaveQuake({ time: HOUR_MS })], hours * HOUR_MS)).toEqual([]);
  });

  it('never ripples an unfelt Earthquake or without a data time', () => {
    expect(getWaves([getWaveQuake({ isFelt: false })], HOUR_MS)).toEqual([]);
    expect(getWaves([getWaveQuake({})], null)).toEqual([]);
  });

  it('re-excites the felt mainshock from an aftershock at 0.7 of its reach', () => {
    const main = getWaveQuake({ time: 0, amplitude: 0.8, lifeSeconds: 1 });
    const after = getWaveQuake({ time: 10 * HOUR_MS, amplitude: 0.2, mainIndex: 0 });
    const waves = getWaves([main, after], 11 * HOUR_MS);

    expect(waves).toContainEqual({ ...getRipple(0.2, 0.5, 1), index: 1 });
    expect(waves).toContainEqual({ ...getRipple(0.8, 0.5, 0.4 * (0.25 + 0.3), 0.7), index: 0 });
  });

  it('plays a wall-clock wave in place of the data-time one', () => {
    const quake = getWaveQuake({ time: HOUR_MS });
    const waves = getGlobeWaves({
      quakes: [quake],
      shownCount: 1,
      dataTime: 1.5 * HOUR_MS,
      lifeMsPerSecond,
      wallWaves: [{ index: 0, progress: 0.4, k: 1.2 }],
    });

    expect(waves).toEqual([{ ...getRipple(0.5, 0.4, 1.2), index: 0 }]);
  });

  it(`keeps the ${MAX_GLOBE_WAVES} strongest waves`, () => {
    const quakes = Array.from({ length: MAX_GLOBE_WAVES + 8 }, (_, index) =>
      getWaveQuake({ time: 0, amplitude: 0.2 + index / 100 }),
    );
    const waves = getWaves(quakes, HOUR_MS);

    expect(waves).toHaveLength(MAX_GLOBE_WAVES);
    expect(Math.min(...waves.map(({ index }) => index))).toBe(8);
  });

  it('only looks at Earthquakes shown up to the playhead', () => {
    const quakes = [getWaveQuake({ time: 0 }), getWaveQuake({ time: 0 })];
    const waves = getGlobeWaves({
      quakes,
      shownCount: 1,
      dataTime: HOUR_MS,
      lifeMsPerSecond,
      wallWaves: [],
    });

    expect(waves.map(({ index }) => index)).toEqual([0]);
  });
});
