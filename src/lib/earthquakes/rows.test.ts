import { describe, expect, it } from 'vitest';

import { getEmscFeature } from '@/test/fixtures/earthquakes';

import { EARTHQUAKE_PAGE_SIZE, getEarthquakeRows, getPageIndex, getTableSorting } from './rows';
import { emscAdapter } from './sources/emsc';

const QUAKE = emscAdapter.getEarthquake(getEmscFeature())!;

describe('getEarthquakeRows', () => {
  it('adds the distance to the centre', () => {
    const [row] = getEarthquakeRows([QUAKE], { latitude: 37.1773, longitude: -3.5986 });
    expect(row?.distanceKm).toBeCloseTo(7.4, 0);
  });

  it('leaves distance null without a centre', () => {
    expect(getEarthquakeRows([QUAKE], null)[0]?.distanceKm).toBeNull();
  });
});

describe('getPageIndex', () => {
  it('maps page to a zero-based index', () => {
    expect(getPageIndex(2, 120)).toBe(1);
  });

  it('clamps a page beyond the last one', () => {
    expect(getPageIndex(9, 120)).toBe(Math.ceil(120 / EARTHQUAKE_PAGE_SIZE) - 1);
    expect(getPageIndex(3, 0)).toBe(0);
  });
});

describe('getTableSorting', () => {
  it('falls back to the default sort when distance is not available', () => {
    expect(getTableSorting('distance.asc', false)).toEqual([{ id: 'time', desc: true }]);
    expect(getTableSorting('distance.asc', true)).toEqual([{ id: 'distance', desc: false }]);
  });
});
