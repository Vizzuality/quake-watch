import { describe, expect, it } from 'vitest';

import type { EarthquakeFilters } from '../search-schema';
import { getFdsnQueryParams, getFeatures } from './feature-collection';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const FILTERS: EarthquakeFilters = { source: 'emsc', interval: '7d', minmag: 0, depth: 'all' };

describe('getFeatures', () => {
  it('returns the raw features', () => {
    expect(getFeatures({ type: 'FeatureCollection', features: [1, 2] })).toEqual([1, 2]);
  });

  it('throws when the payload is not a FeatureCollection', () => {
    expect(() => getFeatures({ type: 'Feature' })).toThrow(/Invalid input/);
    expect(() => getFeatures(null)).toThrow(/Invalid input/);
  });
});

describe('getFdsnQueryParams', () => {
  it('sends order, limit, magnitude and start', () => {
    expect(Object.fromEntries(getFdsnQueryParams(FILTERS, NOW, 20_000))).toEqual({
      orderby: 'time',
      limit: '20000',
      minmagnitude: '0',
      starttime: '2026-10-01T12:00:00.000Z',
    });
  });

  it.each([
    ['24h', '2026-10-07T12:00:00.000Z'],
    ['3d', '2026-10-05T12:00:00.000Z'],
    ['7d', '2026-10-01T12:00:00.000Z'],
  ] as const)('starts %s before now at %s', (interval, starttime) => {
    expect(getFdsnQueryParams({ ...FILTERS, interval }, NOW, 1).get('starttime')).toBe(starttime);
  });

  it.each([0, 3, 4, 5, 6] as const)('sends minmagnitude %s', (minmag) => {
    expect(getFdsnQueryParams({ ...FILTERS, minmag }, NOW, 1).get('minmagnitude')).toBe(
      String(minmag),
    );
  });

  it.each([
    ['all', null, null],
    ['shallow', null, '70'],
    ['mid', '70', '300'],
    ['deep', '300', null],
  ] as const)('maps depth %s to mindepth %s and maxdepth %s', (depth, mindepth, maxdepth) => {
    const params = getFdsnQueryParams({ ...FILTERS, depth }, NOW, 1);
    expect(params.has('mindepth')).toBe(mindepth !== null);
    expect(params.has('maxdepth')).toBe(maxdepth !== null);
    expect(params.get('mindepth')).toBe(mindepth);
    expect(params.get('maxdepth')).toBe(maxdepth);
  });
});
