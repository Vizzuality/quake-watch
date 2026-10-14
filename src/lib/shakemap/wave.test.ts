import { describe, expect, it } from 'vitest';

import {
  P_WAVE_KM_S,
  S_WAVE_KM_S,
  WAVE_SCREEN_MS,
  getArrivalSeconds,
  getArrivedCount,
  getPulse,
  getPulseLengthSeconds,
  getRealSeconds,
  getWaveDurationSeconds,
  getWaveRadiusKm,
} from './wave';

function getPulseSeries(mmi: number, until = 40, step = 0.05): number[] {
  return Array.from({ length: Math.round(until / step) + 1 }, (_, index) =>
    getPulse(index * step, mmi),
  );
}

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
    expect(WAVE_SCREEN_MS).toBe(7_000);
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

describe('getPulse', () => {
  it('is zero before the S wave arrives', () => {
    expect(getPulse(-0.001, 7)).toBe(0);
    expect(getPulse(-100, 7)).toBe(0);
    expect(getPulse(0, 7)).toBe(0);
  });

  it('rises to a peak and then decays to zero', () => {
    const series = getPulseSeries(6);
    const peak = Math.max(...series);
    const peakIndex = series.indexOf(peak);
    expect(peak).toBeGreaterThan(0.5);
    expect(peakIndex).toBeGreaterThan(0);
    expect(series[peakIndex - 1]).toBeLessThan(peak);
    expect(series[peakIndex + 1]).toBeLessThan(peak);
    expect(series.at(-1)).toBe(0);
  });

  it('settles to exactly zero and stays there', () => {
    expect(getPulse(1_000, 9)).toBe(0);
    expect(getPulse(Number.POSITIVE_INFINITY, 9)).toBe(0);
  });

  it('grows in amplitude and duration with Intensity', () => {
    const weak = getPulseSeries(3);
    const strong = getPulseSeries(9);
    expect(Math.max(...strong)).toBeGreaterThan(Math.max(...weak));
    expect(strong.filter((value) => value > 0).length).toBeGreaterThan(
      weak.filter((value) => value > 0).length,
    );
  });

  it('stays within 0..1 and never NaN for odd input', () => {
    for (const mmi of [-5, 0, 4, 10, 25, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const seconds of [-1, 0, 0.3, 2, 9, 30, Number.NaN, Number.POSITIVE_INFINITY]) {
        const value = getPulse(seconds, mmi);
        expect(Number.isNaN(value)).toBe(false);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('getArrivedCount', () => {
  it('counts sorted arrivals at or before the given second', () => {
    const arrivals = [1, 2, 2, 5];
    expect(getArrivedCount(arrivals, 0)).toBe(0);
    expect(getArrivedCount(arrivals, 2)).toBe(3);
    expect(getArrivedCount(arrivals, 10)).toBe(4);
    expect(getArrivedCount([], 10)).toBe(0);
  });
});

describe('getPulseLengthSeconds', () => {
  it('grows with the Intensity and ends exactly when the pulse reaches zero', () => {
    expect(getPulseLengthSeconds(10)).toBeGreaterThan(getPulseLengthSeconds(4));
    expect(getPulseLengthSeconds(Number.NaN)).toBe(5);
    expect(getPulse(getPulseLengthSeconds(7) - 0.01, 7)).toBeGreaterThan(0);
    expect(getPulse(getPulseLengthSeconds(7), 7)).toBe(0);
  });
});
