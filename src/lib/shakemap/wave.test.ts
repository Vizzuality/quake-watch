import { describe, expect, it } from 'vitest';

import {
  P_WAVE_KM_S,
  S_WAVE_KM_S,
  getArrivalSeconds,
  getRealSeconds,
  getWaveDurationSeconds,
  getWaveRadiusKm,
} from './wave';

describe('getArrivalSeconds', () => {
  it('delivers P before S at any distance', () => {
    for (const distanceKm of [0, 10, 250, 1_000]) {
      expect(getArrivalSeconds(distanceKm, 10, P_WAVE_KM_S)).toBeLessThan(
        getArrivalSeconds(distanceKm, 10, S_WAVE_KM_S),
      );
    }
  });

  it('uses the hypocentral distance, so the Depth delays the Epicenter', () => {
    expect(getArrivalSeconds(0, 100, S_WAVE_KM_S)).toBe(25);
    expect(getArrivalSeconds(30, 40, S_WAVE_KM_S)).toBeCloseTo(12.5);
  });
});

describe('getWaveDurationSeconds', () => {
  it('is the S arrival at the farthest reach', () => {
    expect(getWaveDurationSeconds(300, 0)).toBe(75);
    expect(getWaveDurationSeconds(0, 100)).toBe(25);
  });
});

describe('getRealSeconds', () => {
  it('scales progress over the duration and clamps to 0..1', () => {
    expect(getRealSeconds(0.5, 150)).toBe(75);
    expect(getRealSeconds(-1, 150)).toBe(0);
    expect(getRealSeconds(3, 150)).toBe(150);
    expect(getRealSeconds(Number.NaN, 150)).toBe(0);
  });
});

describe('getWaveRadiusKm', () => {
  it('inverts the arrival time on the ground, hidden under the Depth', () => {
    expect(getWaveRadiusKm(0, 100, S_WAVE_KM_S)).toBe(0);
    expect(getWaveRadiusKm(25, 100, S_WAVE_KM_S)).toBe(0);
    expect(getWaveRadiusKm(50, 0, S_WAVE_KM_S)).toBe(200);
    expect(getWaveRadiusKm(50, 120, S_WAVE_KM_S)).toBeCloseTo(160);
    expect(getWaveRadiusKm(-5, 0, S_WAVE_KM_S)).toBe(0);
  });
});
