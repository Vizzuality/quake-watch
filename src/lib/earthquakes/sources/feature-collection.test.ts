import { describe, expect, it } from 'vitest';

import type { EarthquakeFilters } from '../search-schema';
import {
  LIVE_LIMIT,
  LONG_WINDOW_LIMIT,
  getFdsnQuery,
  getFdsnQueryParams,
  getFeatures,
} from './feature-collection';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const FILTERS: EarthquakeFilters = { source: 'emsc', interval: '7d', minmag: 0, depth: 'all' };

function getParams(filters: EarthquakeFilters): URLSearchParams {
  return getFdsnQueryParams(filters, getFdsnQuery(filters, NOW.getTime()));
}

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
    expect(Object.fromEntries(getParams(FILTERS))).toEqual({
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
    expect(getParams({ ...FILTERS, interval }).get('starttime')).toBe(starttime);
  });

  it.each([0, 3, 4, 5, 6] as const)('sends minmagnitude %s', (minmag) => {
    expect(getParams({ ...FILTERS, minmag }).get('minmagnitude')).toBe(String(minmag));
  });

  it.each([
    ['all', null, null],
    ['shallow', null, '70'],
    ['mid', '70', '300'],
    ['deep', '300', null],
  ] as const)('maps depth %s to mindepth %s and maxdepth %s', (depth, mindepth, maxdepth) => {
    const params = getParams({ ...FILTERS, depth });
    expect(params.has('mindepth')).toBe(mindepth !== null);
    expect(params.has('maxdepth')).toBe(maxdepth !== null);
    expect(params.get('mindepth')).toBe(mindepth);
    expect(params.get('maxdepth')).toBe(maxdepth);
  });
});

describe('getFdsnQuery', () => {
  it('orders a week or less by time up to the live limit', () => {
    expect(getFdsnQuery(FILTERS, NOW.getTime())).toMatchObject({
      limit: LIVE_LIMIT,
      orderBy: 'time',
    });
  });

  it('keeps the largest earthquakes of a year, up to the long-window limit', () => {
    const params = getParams({ ...FILTERS, interval: '1y' });
    expect(params.get('orderby')).toBe('magnitude');
    expect(params.get('limit')).toBe(String(LONG_WINDOW_LIMIT));
    expect(params.get('starttime')).toBe('2025-10-08T12:00:00.000Z');
    expect(params.has('endtime')).toBe(false);
  });

  it('sends whole UTC days for a custom range', () => {
    const params = getParams({
      ...FILTERS,
      interval: 'custom',
      from: '2026-09-01',
      to: '2026-09-03',
    });
    expect(params.get('starttime')).toBe('2026-09-01T00:00:00.000Z');
    expect(params.get('endtime')).toBe('2026-09-04T00:00:00.000Z');
    expect(params.get('orderby')).toBe('time');
  });

  it('stops a custom range that ends today at now', () => {
    const params = getParams({
      ...FILTERS,
      interval: 'custom',
      from: '2026-09-01',
      to: '2026-10-08',
    });
    expect(params.get('endtime')).toBe(NOW.toISOString());
    expect(params.get('orderby')).toBe('magnitude');
  });
});
