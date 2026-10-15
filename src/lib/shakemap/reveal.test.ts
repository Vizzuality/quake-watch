import { describe, expect, it } from 'vitest';

import { shakemapCoverage } from '@/test/fixtures/shakemap-coverage';

import { getDistanceKm } from '../earthquakes/distance';
import { getGridLatitude, getGridLongitude, getShakemapGrid } from './coverage';
import { getDrawnReachKm, getMaxReachKm } from './reveal';

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

describe('getDrawnReachKm', () => {
  it('reaches whichever is farther: felt cells or contour vertices', () => {
    const farContour = {
      mmi: 2,
      color: '#fff',
      lines: [[[grid.east, grid.north] as const, [grid.east, grid.south] as const]],
    };
    const southWest = { latitude: grid.south, longitude: grid.west };
    expect(getDrawnReachKm(grid, [farContour], southWest)).toBeCloseTo(
      getDistanceKm(southWest, { latitude: grid.north, longitude: grid.east }),
    );
    expect(getDrawnReachKm(grid, [], epicenter)).toBe(getMaxReachKm(grid, epicenter));
  });
});
