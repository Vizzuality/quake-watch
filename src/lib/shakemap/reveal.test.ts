import { describe, expect, it } from 'vitest';

import { shakemapCoverage } from '@/test/fixtures/shakemap-coverage';

import { getDistanceKm } from '../earthquakes/distance';
import { getGridLatitude, getGridLongitude, getShakemapGrid } from './coverage';
import {
  SHAKEMAP_PLAY_DURATION_MS,
  getIsInsideReveal,
  getMaxReachKm,
  getRevealRadiusKm,
} from './reveal';

const grid = getShakemapGrid(shakemapCoverage);
const epicenter = { latitude: getGridLatitude(grid, 1), longitude: getGridLongitude(grid, 2) };

describe('getMaxReachKm', () => {
  it('reaches the farthest cell at or above the felt Intensity', () => {
    const farthestFelt = {
      latitude: getGridLatitude(grid, 3),
      longitude: getGridLongitude(grid, 3),
    };
    expect(getMaxReachKm(grid, epicenter)).toBeCloseTo(getDistanceKm(epicenter, farthestFelt));
  });

  it('ignores cells below the felt Intensity even when they are farther', () => {
    const southWest = { latitude: grid.south, longitude: grid.west };
    const farthestFelt = {
      latitude: getGridLatitude(grid, 3),
      longitude: getGridLongitude(grid, 3),
    };
    const northEast = { latitude: grid.north, longitude: grid.east };
    const reachKm = getMaxReachKm(grid, southWest);
    expect(reachKm).toBeCloseTo(getDistanceKm(southWest, farthestFelt));
    expect(reachKm).toBeLessThan(getDistanceKm(southWest, northEast));
  });

  it('falls back to the farthest grid corner when no cell is felt', () => {
    const quiet = { ...grid, values: new Float32Array(grid.values.length).fill(1) };
    const farthestCorner = { latitude: grid.north, longitude: grid.east };
    const southWest = { latitude: grid.south, longitude: grid.west };
    expect(getMaxReachKm(quiet, southWest)).toBeCloseTo(getDistanceKm(southWest, farthestCorner));
  });

  it('treats NaN cells as not felt', () => {
    const empty = { ...grid, values: new Float32Array(grid.values.length).fill(Number.NaN) };
    expect(getMaxReachKm(empty, epicenter)).toBeGreaterThan(0);
  });
});

describe('getRevealRadiusKm', () => {
  it('scales linearly with progress', () => {
    expect(getRevealRadiusKm(0, 300)).toBe(0);
    expect(getRevealRadiusKm(0.5, 300)).toBe(150);
    expect(getRevealRadiusKm(1, 300)).toBe(300);
  });

  it('clamps progress to 0..1', () => {
    expect(getRevealRadiusKm(-2, 300)).toBe(0);
    expect(getRevealRadiusKm(7, 300)).toBe(300);
    expect(getRevealRadiusKm(Number.NaN, 300)).toBe(0);
  });

  it('plays over four seconds', () => {
    expect(SHAKEMAP_PLAY_DURATION_MS).toBe(4_000);
  });
});

describe('getIsInsideReveal', () => {
  const point = { latitude: epicenter.latitude + 1, longitude: epicenter.longitude };
  const distanceKm = getDistanceKm(epicenter, point);

  it('includes points within the radius and excludes points beyond it', () => {
    expect(getIsInsideReveal(epicenter, point, distanceKm + 1)).toBe(true);
    expect(getIsInsideReveal(epicenter, point, distanceKm - 1)).toBe(false);
  });

  it('keeps the Epicenter inside a zero radius', () => {
    expect(getIsInsideReveal(epicenter, epicenter, 0)).toBe(true);
  });

  it('measures across the antimeridian', () => {
    const near = { latitude: 0, longitude: 179.9 };
    const across = { latitude: 0, longitude: -179.9 };
    expect(getIsInsideReveal(near, across, 50)).toBe(true);
  });
});
