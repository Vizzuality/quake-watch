import { describe, expect, it } from 'vitest';

import { SECTION_WAVE, getWaveRing } from './section-wave';

describe('section wave', () => {
  it('starts each ring at the hypocentre, fully lit', () => {
    expect(getWaveRing(0, 0, 3)).toEqual({ radius: SECTION_WAVE.minRadius, opacity: 0.55 });
  });

  it('grows and fades a ring over one period', () => {
    const half = getWaveRing(SECTION_WAVE.periodMs / 2, 0, 3);

    expect(half.radius).toBeCloseTo((SECTION_WAVE.minRadius + SECTION_WAVE.maxRadius) / 2);
    expect(half.opacity).toBeLessThan(0.55);
    expect(half.opacity).toBeGreaterThan(0);
  });

  it('loops back to the start after a full period', () => {
    expect(getWaveRing(SECTION_WAVE.periodMs, 0, 3)).toEqual(getWaveRing(0, 0, 3));
  });

  it('staggers the rings evenly through the period', () => {
    const second = getWaveRing(0, 1, 3);
    const later = getWaveRing(SECTION_WAVE.periodMs / 3, 0, 3);

    expect(second.radius).toBeCloseTo(later.radius);
    expect(second.opacity).toBeCloseTo(later.opacity);
  });
});
