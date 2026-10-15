import { describe, expect, it } from 'vitest';

import { getDistanceKm } from '@/lib/earthquakes/distance';
import { shakemapCoverage } from '@/test/fixtures/shakemap-coverage';

import { getGridLatitude, getGridLongitude, getShakemapGrid } from './coverage';
import { getRevealedMmi, getShakemapReveal } from './readout';
import { S_WAVE_KM_S, getArrivalSeconds } from './wave';

const grid = getShakemapGrid(shakemapCoverage);
const epicenter = { latitude: getGridLatitude(grid, 1), longitude: getGridLongitude(grid, 2) };
const farCell = { latitude: getGridLatitude(grid, 3), longitude: getGridLongitude(grid, 4) };
const farArrival = getArrivalSeconds(getDistanceKm(epicenter, farCell), 0, S_WAVE_KM_S);

describe('getShakemapReveal', () => {
  it('keeps the Epicenter, Depth, clock and completion', () => {
    expect(getShakemapReveal(epicenter, 12, 30, false)).toEqual({
      epicenter,
      depthKm: 12,
      seconds: 30,
      complete: false,
    });
  });
});

describe('getRevealedMmi', () => {
  it('reads the grid once the S wave has passed the point', () => {
    expect(getRevealedMmi(grid, getShakemapReveal(epicenter, 0, 0, false), epicenter)).toBeCloseTo(
      3.2,
    );
  });

  it('hides places the S wave has not reached, then shows them the moment it arrives', () => {
    const before = getShakemapReveal(epicenter, 0, farArrival - 0.5, false);
    const after = getShakemapReveal(epicenter, 0, farArrival, false);
    expect(getRevealedMmi(grid, before, farCell)).toBeNull();
    expect(getRevealedMmi(grid, after, farCell)).toBeCloseTo(1.6);
  });

  it('delays the Epicenter itself by the Depth', () => {
    expect(
      getRevealedMmi(grid, getShakemapReveal(epicenter, 100, 24, false), epicenter),
    ).toBeNull();
    expect(
      getRevealedMmi(grid, getShakemapReveal(epicenter, 100, 25, false), epicenter),
    ).toBeCloseTo(3.2);
  });

  it('reads every cell once complete, even before the clock gets there', () => {
    expect(getRevealedMmi(grid, getShakemapReveal(epicenter, 0, 0, true), farCell)).toBeCloseTo(
      1.6,
    );
  });

  it('shows nothing outside the grid or on missing cells', () => {
    const reveal = getShakemapReveal(epicenter, 0, 5_000, true);
    expect(getRevealedMmi(grid, reveal, { latitude: 0, longitude: 0 })).toBeNull();
    const missing = { latitude: getGridLatitude(grid, 2), longitude: getGridLongitude(grid, 2) };
    expect(getRevealedMmi(grid, reveal, missing)).toBeNull();
  });
});
