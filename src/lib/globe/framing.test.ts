import { describe, expect, it } from 'vitest';

import { FRAME_STEP_DEG, FRAME_WINDOW_DEG, getFramedLongitude } from './framing';

function getEarthquakesAt(longitudes: readonly number[], magnitude = 3) {
  return longitudes.map((longitude) => ({ longitude, magnitude }));
}

function getWeightSum(magnitudes: readonly number[]): number {
  return magnitudes.reduce((sum, magnitude) => sum + 10 ** magnitude, 0);
}

describe('getFramedLongitude', () => {
  it('uses a 60° window in 5° steps', () => {
    expect(FRAME_WINDOW_DEG).toBe(60);
    expect(FRAME_STEP_DEG).toBe(5);
  });

  it('returns undefined without earthquakes', () => {
    expect(getFramedLongitude([])).toBeUndefined();
  });

  it('centres on a cluster at 140–160°', () => {
    expect(getFramedLongitude(getEarthquakesAt([140, 145, 150, 155, 160, -30, 10]))).toBe(150);
  });

  it('returns the middle of a top run that wraps across ±180°', () => {
    expect(getFramedLongitude(getEarthquakesAt([175, -175, 178]))).toBe(-180);
    expect(getFramedLongitude(getEarthquakesAt([150, -150, 175, -175, 178, 0]))).toBe(-180);
  });

  it('includes a longitude exactly 30° from the centre', () => {
    expect(getFramedLongitude(getEarthquakesAt([150, 120]))).toBe(135);
  });

  it('lands off the 5° grid when the run has an even length', () => {
    expect(getFramedLongitude(getEarthquakesAt([120, 145, 175]))).toBe(147.5);
  });

  it('picks the run whose middle is nearest 150°', () => {
    expect(getFramedLongitude(getEarthquakesAt([-90, 100]))).toBe(100);
  });

  it('picks the lower middle when two runs are equally near 150°', () => {
    expect(getFramedLongitude(getEarthquakesAt([115, 125, 175, -175]))).toBe(145);
  });

  it('returns 150° when every window holds the same weight', () => {
    const everyFiveDegrees = Array.from({ length: 72 }, (_, index) => -180 + index * 5);
    expect(getFramedLongitude(getEarthquakesAt(everyFiveDegrees))).toBe(150);
  });

  it('frames fewer but stronger earthquakes over more weaker ones', () => {
    const earthquakes = [
      ...getEarthquakesAt([-62, -60, -58], 4),
      ...getEarthquakesAt([20, 20, 20, 20, 20], 3),
    ];
    expect(getFramedLongitude(earthquakes)).toBe(-60);
  });

  it('frames one M7 over fifty M2', () => {
    const earthquakes = [
      ...getEarthquakesAt([-60], 7),
      ...getEarthquakesAt(
        Array.from({ length: 50 }, () => 100),
        2,
      ),
    ];
    expect(getFramedLongitude(earthquakes)).toBe(-60);
  });

  it('treats sums that differ only by float rounding as tied', () => {
    const westMagnitudes = [2, 2.2, 2.3];
    const eastMagnitudes = [2.3, 2.2, 2];
    expect(getWeightSum(westMagnitudes)).toBeGreaterThan(getWeightSum(eastMagnitudes));
    const earthquakes = [
      ...westMagnitudes.map((magnitude) => ({ longitude: -60, magnitude })),
      ...eastMagnitudes.map((magnitude) => ({ longitude: 150, magnitude })),
    ];
    expect(getFramedLongitude(earthquakes)).toBe(150);
  });
});
