import { describe, expect, it } from 'vitest';

import { getDepthRgb } from '../earthquakes/depth-color';
import { getFeltReachKm } from '../earthquakes/intensity';
import type { Earthquake } from '../earthquakes/types';
import {
  FELT_RING_LOOK,
  getFeltRingAngle,
  getFeltRingAttributes,
  getMinRingRadiusPx,
  getWaveFronts,
  getWaveLifeSeconds,
  getWavesEndTime,
} from './felt-rings';
import { EARTH_RADIUS_KM } from './quakes';
import { getLatLonVector } from './sphere';

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

describe('FELT_RING_LOOK', () => {
  it('pins the prototype look', () => {
    expect(FELT_RING_LOOK).toEqual({
      strokeA: 0.4,
      fillA: 0.094,
      hollowA: 0.7,
      hollowGapPx: 3,
      frontA: 0.85,
      pFrontK: 0.5,
      glowA: 0.5,
      glowBasePx: 6,
      glowAmpPx: 22,
      strokePx: 1,
      frontPx: 1.2,
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
});

describe('getWavesEndTime', () => {
  const m5 = getEarthquake({ id: 'm5', magnitude: 5, depthKm: 10 });
  const m7 = getEarthquake({ id: 'm7', magnitude: 7, depthKm: 10 });
  const unfelt = getEarthquake({ id: 'unfelt', magnitude: 4, depthKm: 500 });

  it('ends when the last started felt wave ends', () => {
    const starts = new Map([
      ['m5', 10],
      ['m7', 9],
    ]);
    const end = Math.max(10 + getWaveLifeSeconds(5), 9 + getWaveLifeSeconds(7));

    expect(getWavesEndTime([m5, m7], starts)).toBeCloseTo(end, 9);
  });

  it('skips a quake nobody feels, as the ring shader does', () => {
    const starts = new Map([
      ['m5', 1],
      ['unfelt', 100],
    ]);

    expect(getWavesEndTime([m5, unfelt], starts)).toBeCloseTo(1 + getWaveLifeSeconds(5), 9);
  });

  it('ignores starts of quakes no longer shown', () => {
    expect(getWavesEndTime([m5], new Map([['gone', 100]]))).toBe(-Infinity);
  });

  it('has no end before any wave starts', () => {
    expect(getWavesEndTime([m5, m7], new Map())).toBe(-Infinity);
    expect(getWavesEndTime([], new Map())).toBe(-Infinity);
  });
});

describe('getWaveFronts', () => {
  const depthKm = 10;
  const reachKm = getFeltReachKm({ magnitude: 5, depthKm });
  const reachAngle = reachKm / EARTH_RADIUS_KM;

  it('starts both fronts at the epicentre', () => {
    expect(getWaveFronts({ progress: 0, reachKm, depthKm })).toEqual({ sAngle: 0, pAngle: 0 });
  });

  it('lands the S front on the Felt reach as the wave ends, with P already gone', () => {
    const fronts = getWaveFronts({ progress: 1, reachKm, depthKm });
    expect(fronts.sAngle).toBeCloseTo(reachAngle, 9);
    expect(fronts.pAngle).toBeNull();
  });

  it('keeps P ahead of S mid-wave, both inside the reach', () => {
    const { sAngle, pAngle } = getWaveFronts({ progress: 0.5, reachKm, depthKm });
    expect(sAngle).toBeGreaterThan(0);
    expect(sAngle).toBeLessThan(reachAngle);
    expect(pAngle).not.toBeNull();
    expect(pAngle).toBeGreaterThan(sAngle);
    expect(pAngle).toBeLessThan(reachAngle);
  });

  it('clamps progress outside 0..1', () => {
    expect(getWaveFronts({ progress: 2, reachKm, depthKm })).toEqual(
      getWaveFronts({ progress: 1, reachKm, depthKm }),
    );
    expect(getWaveFronts({ progress: -1, reachKm, depthKm })).toEqual({ sAngle: 0, pAngle: 0 });
  });

  it('has no fronts when the quake is not felt', () => {
    expect(getWaveFronts({ progress: 0.5, reachKm: 0, depthKm: 500 })).toEqual({
      sAngle: 0,
      pAngle: null,
    });
  });
});

describe('getFeltRingAttributes', () => {
  it('packs one instance per Earthquake, felt or not', () => {
    const felt = getEarthquake({ id: 'a', magnitude: 5, depthKm: 10, latitude: 10, longitude: 20 });
    const hollow = getEarthquake({ id: 'b', magnitude: 4, depthKm: 500, latitude: -30 });
    const attributes = getFeltRingAttributes([felt, hollow]);

    expect(attributes.direction).toHaveLength(6);
    expect(attributes.reachAngle).toHaveLength(2);
    expect(attributes.color).toHaveLength(6);

    const direction = getLatLonVector(10, 20);
    for (const [axis, value] of direction.entries()) {
      expect(attributes.direction[axis]).toBeCloseTo(value, 6);
    }
    expect(attributes.reachAngle[0]).toBeCloseTo(getFeltRingAngle(5, 10), 6);
    expect(attributes.reachAngle[1]).toBe(0);
    expect(attributes.minPx[0]).toBeCloseTo(getMinRingRadiusPx(5), 6);
    expect(attributes.minPx[1]).toBeCloseTo(getMinRingRadiusPx(4), 6);
    const [r, g, b] = getDepthRgb(500);
    expect(attributes.color[3]).toBeCloseTo(r / 255, 6);
    expect(attributes.color[4]).toBeCloseTo(g / 255, 6);
    expect(attributes.color[5]).toBeCloseTo(b / 255, 6);
    expect(Array.from(attributes.depthKm)).toEqual([10, 500]);
    expect(attributes.life[0]).toBeCloseTo(getWaveLifeSeconds(5), 6);
    expect(attributes.glowPx[0]).toBeCloseTo(6 + 22 * ((5 - 2) / 4.4), 5);
    expect(attributes.glowPx[1]).toBeCloseTo(6 + 22 * ((4 - 2) / 4.4), 5);
  });

  it('returns empty arrays for no quakes', () => {
    expect(getFeltRingAttributes([]).reachAngle).toHaveLength(0);
  });
});
