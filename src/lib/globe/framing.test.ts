import { describe, expect, it } from 'vitest';

import { FRAME_STEP_DEG, FRAME_WINDOW_DEG, getDensestLongitude } from './framing';

describe('getDensestLongitude', () => {
  it('uses a 60° window in 5° steps', () => {
    expect(FRAME_WINDOW_DEG).toBe(60);
    expect(FRAME_STEP_DEG).toBe(5);
  });

  it('returns undefined without longitudes', () => {
    expect(getDensestLongitude([])).toBeUndefined();
  });

  it('centres on a cluster at 140–160°', () => {
    expect(getDensestLongitude([140, 145, 150, 155, 160, -30, 10])).toBe(150);
  });

  it('returns the middle of a densest run that wraps across ±180°', () => {
    expect(getDensestLongitude([175, -175, 178])).toBe(-180);
    expect(getDensestLongitude([150, -150, 175, -175, 178, 0])).toBe(-180);
  });

  it('includes a longitude exactly 30° from the centre', () => {
    expect(getDensestLongitude([150, 120])).toBe(135);
  });

  it('lands off the 5° grid when the run has an even length', () => {
    expect(getDensestLongitude([120, 145, 175])).toBe(147.5);
  });

  it('picks the run whose middle is nearest 150°', () => {
    expect(getDensestLongitude([-90, 100])).toBe(100);
  });

  it('picks the lower middle when two runs are equally near 150°', () => {
    expect(getDensestLongitude([115, 125, 175, -175])).toBe(145);
  });

  it('returns 150° when every window holds the same count', () => {
    const everyFiveDegrees = Array.from({ length: 72 }, (_, index) => -180 + index * 5);
    expect(getDensestLongitude(everyFiveDegrees)).toBe(150);
  });
});
