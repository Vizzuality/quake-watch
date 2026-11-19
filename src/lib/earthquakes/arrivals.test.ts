import { describe, expect, it } from 'vitest';

import {
  getArrivedIds,
  getNewestArrivedId,
  getPulseGlowAlpha,
  getPulseRingAlpha,
  getPulseRingRadiusPx,
} from './arrivals';

describe('getArrivedIds', () => {
  it('marks nothing as new on the first load', () => {
    expect(getArrivedIds(null, ['a', 'b'])).toEqual(new Set());
  });

  it('marks the Earthquakes that were not in the previous refresh', () => {
    expect(getArrivedIds(new Set(['a', 'b']), ['c', 'a', 'b', 'd'])).toEqual(new Set(['c', 'd']));
  });

  it('ignores Earthquakes that dropped out of the window', () => {
    expect(getArrivedIds(new Set(['a', 'b']), ['b'])).toEqual(new Set());
  });
});

describe('getNewestArrivedId', () => {
  const earthquakes = [
    { id: 'a', time: 30 },
    { id: 'b', time: 20 },
    { id: 'c', time: 10 },
  ];

  it('picks the latest Earthquake among the arrivals', () => {
    expect(getNewestArrivedId(new Set(['b', 'c']), earthquakes)).toBe('b');
  });

  it('has none without arrivals', () => {
    expect(getNewestArrivedId(new Set(), earthquakes)).toBeUndefined();
  });
});

describe('pulse rings', () => {
  it('starts three rings a third of a 1.6 s cycle apart, growing 6 → 44 px', () => {
    expect([0, 1, 2].map((ring) => getPulseRingRadiusPx(0, ring))).toEqual([
      6,
      6 + 38 / 3,
      6 + (38 * 2) / 3,
    ]);
    expect(getPulseRingAlpha(0, 0)).toBeCloseTo(0.85, 9);
    expect(getPulseRingAlpha(0, 1)).toBeCloseTo((2 / 3) * 0.85, 9);
  });

  it('fades every ring over the 6 s pulse', () => {
    const f = (3_000 / 1_600) % 1;
    expect(getPulseRingRadiusPx(3_000, 0)).toBeCloseTo(6 + 38 * f, 9);
    expect(getPulseRingAlpha(3_000, 0)).toBeCloseTo((1 - f) * 0.85 * 0.5, 9);
  });

  it.each([-1, 6_000, 9_000, Number.NaN])('draws no ring at %f ms', (elapsedMs) => {
    expect(getPulseRingAlpha(elapsedMs, 0)).toBe(0);
  });
});

describe('getPulseGlowAlpha', () => {
  it('fades the 14 px glow from 0.9 to 0 over the pulse', () => {
    expect(getPulseGlowAlpha(0)).toBe(0.9);
    expect(getPulseGlowAlpha(3_000)).toBeCloseTo(0.45, 9);
    expect(getPulseGlowAlpha(6_000)).toBe(0);
  });
});
