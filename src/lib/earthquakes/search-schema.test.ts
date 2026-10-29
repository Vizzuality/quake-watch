import { describe, expect, it } from 'vitest';

import {
  EARTHQUAKE_FILTER_DEFAULTS,
  EARTHQUAKE_SEARCH_DEFAULTS,
  earthquakeSearchSchema,
  getSearchCenter,
  getSortParam,
  getSortingState,
  getTimeRange,
  isDefaultEarthquakeSearch,
} from './search-schema';

const NOW = new Date('2026-10-08T12:00:00.000Z');

function getSearch(input: Record<string, unknown> = {}) {
  return earthquakeSearchSchema.parse(input);
}

describe('earthquakeSearchSchema', () => {
  it('fills defaults', () => {
    expect(EARTHQUAKE_SEARCH_DEFAULTS).toMatchObject({
      source: 'emsc',
      radius: 100,
      period: '24h',
      minmag: 2.5,
      sort: 'time.desc',
      page: 1,
    });
  });

  it('keeps valid values', () => {
    expect(
      getSearch({
        source: 'usgs',
        place: 'Granada',
        lat: 37.17,
        lon: -3.6,
        radius: 250,
        period: '1y',
        minmag: 4,
        sort: 'magnitude.asc',
        page: 3,
      }),
    ).toMatchObject({
      source: 'usgs',
      place: 'Granada',
      lat: 37.17,
      lon: -3.6,
      radius: 250,
      period: '1y',
      minmag: 4,
      sort: 'magnitude.asc',
      page: 3,
    });
  });

  it('falls back field by field on invalid values', () => {
    expect(
      getSearch({
        source: 'nope',
        lat: 120,
        lon: 'x',
        radius: 75,
        period: '2w',
        minmag: 'banana',
        sort: 'id.desc',
        page: 0,
        from: '2026-13-01',
      }),
    ).toMatchObject({
      source: 'emsc',
      lat: undefined,
      lon: undefined,
      radius: 100,
      period: '24h',
      minmag: 2.5,
      sort: 'time.desc',
      page: 1,
      from: undefined,
    });
  });
});

describe('isDefaultEarthquakeSearch', () => {
  it('is true for a search with no params', () => {
    expect(isDefaultEarthquakeSearch(getSearch())).toBe(true);
  });

  it('is true when every param spells out its default', () => {
    expect(isDefaultEarthquakeSearch(getSearch({ minmag: 2.5, sort: 'time.desc', page: 1 }))).toBe(
      true,
    );
  });

  it.each([
    { minmag: 4 },
    { page: 2 },
    { sort: 'magnitude.desc' },
    { t: '2026-10-08T12:00:00.000Z' },
    { source: 'usgs' },
    { lat: 37.17, lon: -3.6 },
    { period: 'custom', from: '2026-10-01' },
    { window: '7d' },
  ])('is false for %o', (input) => {
    expect(isDefaultEarthquakeSearch(getSearch(input))).toBe(false);
  });
});

describe('playback search params', () => {
  it('defaults window to 24h and t to undefined', () => {
    expect(EARTHQUAKE_SEARCH_DEFAULTS.window).toBe('24h');
    expect(EARTHQUAKE_SEARCH_DEFAULTS.t).toBeUndefined();
  });

  it('accepts a toISOString datetime and a 7d window', () => {
    const t = new Date(1_760_000_000_123).toISOString();
    expect(getSearch({ t, window: '7d' })).toMatchObject({ t, window: '7d' });
  });

  it('drops an invalid t and falls back an invalid window', () => {
    expect(getSearch({ t: 'banana', window: '30d' })).toMatchObject({
      t: undefined,
      window: '24h',
    });
  });

  it('keeps t and window out of the filter defaults', () => {
    expect(EARTHQUAKE_FILTER_DEFAULTS).not.toHaveProperty('t');
    expect(EARTHQUAKE_FILTER_DEFAULTS).not.toHaveProperty('window');
  });
});

describe('getSearchCenter', () => {
  it('returns the centre when both coordinates are set', () => {
    expect(getSearchCenter(getSearch({ lat: 37.17, lon: -3.6 }))).toEqual({
      latitude: 37.17,
      longitude: -3.6,
    });
  });

  it('returns null when one coordinate is missing or invalid', () => {
    expect(getSearchCenter(getSearch({ lat: 37.17 }))).toBeNull();
    expect(getSearchCenter(getSearch({ lat: 37.17, lon: 400 }))).toBeNull();
  });
});

describe('getTimeRange', () => {
  it.each([
    ['24h', '2026-10-07T12:00:00.000Z'],
    ['7d', '2026-10-01T12:00:00.000Z'],
    ['30d', '2026-09-08T12:00:00.000Z'],
    ['1y', '2025-10-08T12:00:00.000Z'],
  ])('%s starts at %s with an open end', (period, start) => {
    const range = getTimeRange(getSearch({ period }), NOW);
    expect(range.start.toISOString()).toBe(start);
    expect(range.end).toBeNull();
  });

  it('uses whole UTC days for a custom range', () => {
    const range = getTimeRange(
      getSearch({ period: 'custom', from: '2026-08-14', to: '2026-08-16' }),
      NOW,
    );
    expect(range.start.toISOString()).toBe('2026-08-14T00:00:00.000Z');
    expect(range.end?.toISOString()).toBe('2026-08-16T23:59:59.999Z');
  });

  it('swaps a reversed custom range', () => {
    const range = getTimeRange(
      getSearch({ period: 'custom', from: '2026-08-16', to: '2026-08-14' }),
      NOW,
    );
    expect(range.start.toISOString()).toBe('2026-08-14T00:00:00.000Z');
    expect(range.end?.toISOString()).toBe('2026-08-16T23:59:59.999Z');
  });

  it('treats a custom range without from as the last 24 h and without to as open', () => {
    const range = getTimeRange(getSearch({ period: 'custom' }), NOW);
    expect(range.start.toISOString()).toBe('2026-10-07T12:00:00.000Z');
    expect(range.end).toBeNull();
  });

  it('keeps to when from is missing', () => {
    const range = getTimeRange(getSearch({ period: 'custom', to: '2026-10-08' }), NOW);
    expect(range.start.toISOString()).toBe('2026-10-07T12:00:00.000Z');
    expect(range.end?.toISOString()).toBe('2026-10-08T23:59:59.999Z');
  });
});

describe('getTimeRange with a past to and no from', () => {
  it('starts 24 h before the end of the to day', () => {
    const range = getTimeRange(getSearch({ period: 'custom', to: '2026-08-01' }), NOW);
    expect(range.end?.toISOString()).toBe('2026-08-01T23:59:59.999Z');
    expect(range.start.toISOString()).toBe('2026-07-31T23:59:59.999Z');
    expect(range.start.getTime()).toBeLessThan(range.end?.getTime() ?? 0);
  });
});

describe('sorting', () => {
  it('round-trips between the URL and TanStack state', () => {
    expect(getSortingState('distance.asc')).toEqual([{ id: 'distance', desc: false }]);
    expect(getSortParam([{ id: 'magnitude', desc: true }])).toBe('magnitude.desc');
  });

  it('falls back to the default sort when sorting is cleared', () => {
    expect(getSortParam([])).toBe('time.desc');
  });
});
