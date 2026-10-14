import { describe, expect, it } from 'vitest';

import { shakemapCoverage } from '@/test/fixtures/shakemap-coverage';

import { getGridLatitude, getGridLongitude, getShakemapGrid } from './coverage';
import { getRevealedMmi, getShakemapReveal } from './readout';

const grid = getShakemapGrid(shakemapCoverage);
const epicenter = { latitude: getGridLatitude(grid, 1), longitude: getGridLongitude(grid, 2) };
const farCell = { latitude: getGridLatitude(grid, 3), longitude: getGridLongitude(grid, 4) };

describe('getShakemapReveal', () => {
  it('scales the radius with progress and completes at the end', () => {
    expect(getShakemapReveal(epicenter, 0.5, 200)).toEqual({
      epicenter,
      radiusKm: 100,
      complete: false,
    });
    expect(getShakemapReveal(epicenter, 1, 200)).toEqual({
      epicenter,
      radiusKm: 200,
      complete: true,
    });
  });
});

describe('getRevealedMmi', () => {
  it('reads the grid inside the revealed radius', () => {
    const reveal = getShakemapReveal(epicenter, 0.01, 100);
    expect(getRevealedMmi(grid, reveal, epicenter)).toBeCloseTo(3.2);
  });

  it('hides places the Shaking wave has not reached yet', () => {
    expect(getRevealedMmi(grid, getShakemapReveal(epicenter, 0.1, 100), farCell)).toBeNull();
    expect(getRevealedMmi(grid, getShakemapReveal(epicenter, 0.99, 1_000), farCell)).toBeCloseTo(
      1.6,
    );
  });

  it('reads every cell once the reveal is complete, even beyond the Felt reach', () => {
    const reveal = getShakemapReveal(epicenter, 1, 10);
    expect(getRevealedMmi(grid, reveal, farCell)).toBeCloseTo(1.6);
  });

  it('shows nothing outside the grid or on missing cells', () => {
    const reveal = getShakemapReveal(epicenter, 1, 5_000);
    expect(getRevealedMmi(grid, reveal, { latitude: 0, longitude: 0 })).toBeNull();
    const missing = { latitude: getGridLatitude(grid, 2), longitude: getGridLongitude(grid, 2) };
    expect(getRevealedMmi(grid, reveal, missing)).toBeNull();
  });
});
