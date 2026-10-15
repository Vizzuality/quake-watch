import { describe, expect, it } from 'vitest';

import { getFeltReachKm, getIntensity, getIntensityLevel } from './intensity';
import { getEarthquakeMeaning, getRoundedReachKm } from './meaning';

describe('getRoundedReachKm', () => {
  it.each([
    [0.4, 1],
    [7.6, 8],
    [23.4, 23],
    [184, 180],
    [1234, 1200],
  ])('rounds %s km to %s km', (reachKm, rounded) => {
    expect(getRoundedReachKm(reachKm)).toBe(rounded);
  });
});

describe('getEarthquakeMeaning', () => {
  it('gives the rounded Felt reach when there is no Place of interest', () => {
    const quake = { magnitude: 5.3, depthKm: 29 };
    expect(getEarthquakeMeaning({ ...quake, distanceKm: null })).toEqual({
      kind: 'felt-reach',
      reachKm: getRoundedReachKm(getFeltReachKm(quake)),
    });
  });

  it('says not felt when even the Epicenter stays below Intensity II', () => {
    expect(getEarthquakeMeaning({ magnitude: 0.5, depthKm: 30, distanceKm: null })).toEqual({
      kind: 'not-felt',
    });
  });

  it('gives the estimated Intensity at the Place of interest', () => {
    const input = { magnitude: 6.2, depthKm: 10, distanceKm: 40 };
    expect(getEarthquakeMeaning(input)).toEqual({
      kind: 'at-place',
      ...getIntensityLevel(getIntensity(input)),
    });
  });

  it('reports a far Place of interest as not felt', () => {
    expect(getEarthquakeMeaning({ magnitude: 3, depthKm: 10, distanceKm: 900 })).toMatchObject({
      kind: 'at-place',
      key: 'not_felt',
    });
  });
});
