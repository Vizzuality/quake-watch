import { describe, expect, it } from 'vitest';

import {
  P_WAVE_KM_S,
  S_WAVE_KM_S,
  getArrivalSeconds,
  getRealSeconds,
  getRipple,
  getRippleEnvelope,
  getRippleReach,
  getWaveDurationSeconds,
  getWaveProgress,
  getWaveRadiusKm,
} from './waves';

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

describe('getRippleReach', () => {
  it.each([
    [0.12, 0.06648],
    [0.5, 0.1725],
    [1, 0.51],
  ])('reaches 0.06 + 0.45 amp² rad for amplitude %f', (amplitude, reach) => {
    expect(getRippleReach(amplitude)).toBeCloseTo(reach, 6);
  });

  it('scales the reach and has none without amplitude', () => {
    expect(getRippleReach(1, 0.7)).toBeCloseTo(0.357, 6);
    expect(getRippleReach(0)).toBe(0);
  });
});

describe('getRippleEnvelope', () => {
  it('rises linearly over the first 8 % and peaks at k × (0.35 + 0.65 amp)', () => {
    expect(getRippleEnvelope(0.04, 1, 1)).toBeCloseTo(0.5, 9);
    expect(getRippleEnvelope(0.08, 1.2, 0.5)).toBeCloseTo(1.2 * 0.675, 9);
  });

  it('decays as (1 − t)^1.2 after the peak', () => {
    expect(getRippleEnvelope(0.54, 1, 1)).toBeCloseTo(0.5 ** 1.2, 9);
    expect(getRippleEnvelope(1, 1, 1)).toBe(0);
  });
});

describe('getRipple', () => {
  it('moves the front to reach × p^0.8 with λ = max(0.09, 0.3 reach)', () => {
    const ripple = getRipple(1, 0.5, 1);
    expect(ripple?.reach).toBeCloseTo(0.51, 9);
    expect(ripple?.front).toBeCloseTo(0.51 * 0.5 ** 0.8, 9);
    expect(ripple?.lambda).toBeCloseTo(0.153, 9);
    expect(ripple?.envelope).toBeCloseTo(getRippleEnvelope(0.5, 1, 1), 9);
    expect(ripple?.minCos).toBeCloseTo(Math.cos(0.51 + 0.153), 9);
    expect(getRipple(0.12, 0.5, 1)?.lambda).toBe(0.09);
  });

  it('caps the culling angle at π for a reach past the antipode', () => {
    expect(getRipple(1, 0.5, 1, 6)?.minCos).toBe(-1);
  });

  it.each([0, 1, -0.1, 1.5])('has no ripple at progress %f', (progress) => {
    expect(getRipple(1, progress, 1)).toBeNull();
  });

  it('has no ripple without amplitude', () => {
    expect(getRipple(0, 0.5, 1)).toBeNull();
  });
});

describe('getWaveProgress', () => {
  it('is the data time since the Earthquake over its life, so a paused playhead freezes it', () => {
    expect(getWaveProgress(5_000, 4_000, 4_000)).toBe(0.25);
    expect(getWaveProgress(4_000, 4_000, 4_000)).toBe(0);
    expect(getWaveProgress(3_000, 4_000, 4_000)).toBe(-0.25);
  });
});
