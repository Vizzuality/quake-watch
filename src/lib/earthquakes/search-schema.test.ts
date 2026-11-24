import { describe, expect, it } from 'vitest';

import {
  DEPTH_RANGES_KM,
  EARTHQUAKE_SEARCH_DEFAULTS,
  EARTHQUAKE_SEARCH_ROUTE,
  earthquakeSearchSchema,
  getEarthquakeFilters,
  getCustomRangeError,
  getDefaultCustomRange,
  getTimeWindow,
  getRoundedCoordinate,
} from './search-schema';

const NOW = new Date('2026-10-08T12:00:00.000Z');

function getSearch(input: Record<string, unknown> = {}) {
  return earthquakeSearchSchema.parse(input);
}

describe('earthquakeSearchSchema', () => {
  it('fills the six defaults and leaves the rest undefined', () => {
    expect(getSearch()).toEqual({
      source: 'emsc',
      interval: '7d',
      minmag: 0,
      depth: 'all',
      radius: 100,
      view: 'map',
      place: undefined,
      plat: undefined,
      plon: undefined,
      quake: undefined,
      lat: undefined,
      lon: undefined,
      zoom: undefined,
    });
  });

  it('keeps every valid value', () => {
    expect(
      getSearch({
        source: 'usgs',
        place: '  Granada ',
        plat: 37.173,
        plon: -3.599,
        radius: 250,
        interval: '3d',
        minmag: 5,
        depth: 'deep',
        quake: 'usgs:us7000abcd',
        lat: 37.17,
        lon: -3.6,
        zoom: 4.5,
        view: 'section',
      }),
    ).toEqual({
      source: 'usgs',
      place: 'Granada',
      plat: 37.17,
      plon: -3.6,
      radius: 250,
      interval: '3d',
      minmag: 5,
      depth: 'deep',
      quake: 'usgs:us7000abcd',
      lat: 37.17,
      lon: -3.6,
      zoom: 4.5,
      view: 'section',
    });
  });

  it.each(['24h', '3d', '7d', '1y'])('accepts interval %s', (interval) => {
    expect(getSearch({ interval }).interval).toBe(interval);
  });

  it.each(['emsc', 'usgs', 'all'])('accepts source %s', (source) => {
    expect(getSearch({ source }).source).toBe(source);
  });

  it('keeps a valid custom range', () => {
    expect(getSearch({ interval: 'custom', from: '2026-01-01', to: '2026-01-31' })).toMatchObject({
      interval: 'custom',
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });

  it.each([
    { from: '2026-02-01', to: '2026-01-31' },
    { from: '2024-01-01', to: '2026-01-31' },
    { from: '2026-01-01' },
    { from: 'yesterday', to: '2026-01-31' },
  ])('falls back to 7d for the custom range %o', (range) => {
    expect(getSearch({ interval: 'custom', ...range })).toMatchObject({
      interval: '7d',
      from: undefined,
      to: undefined,
    });
  });

  it('drops from and to outside a custom range', () => {
    expect(getSearch({ interval: '1y', from: '2026-01-01', to: '2026-01-31' })).toMatchObject({
      interval: '1y',
      from: undefined,
      to: undefined,
    });
  });

  it.each([0, 3, 4, 5, 6])('accepts minmag %s', (minmag) => {
    expect(getSearch({ minmag }).minmag).toBe(minmag);
  });

  it.each(['emsc:20261013_0000326', 'usgs:us6000u4j2', `usgs:${'a'.repeat(64)}`])(
    'accepts quake %s',
    (quake) => {
      expect(getSearch({ quake }).quake).toBe(quake);
    },
  );

  it.each([
    ['source', 'nope', 'emsc'],
    ['source', 1, 'emsc'],
    ['interval', '30d', '7d'],
    ['interval', 'custom', '7d'],
    ['minmag', 2.5, 0],
    ['minmag', '5', 0],
    ['minmag', 'banana', 0],
    ['depth', 'foo', 'all'],
    ['view', 'globe', 'map'],
    ['view', 1, 'map'],
    ['place', '', undefined],
    ['place', '   ', undefined],
    ['place', 'x'.repeat(121), undefined],
    ['place', 12_345, undefined],
    ['quake', 'foo:1', undefined],
    ['quake', 'usgs:', undefined],
    ['quake', 'usgs:a/b', undefined],
    ['quake', `usgs:${'a'.repeat(65)}`, undefined],
    ['quake', 'usgs:a&b=c', undefined],
    ['lat', 91, undefined],
    ['lat', -90.01, undefined],
    ['lat', 'x', undefined],
    ['lon', -181, undefined],
    ['lon', 180.5, undefined],
    ['zoom', 21, undefined],
    ['zoom', -1, undefined],
    ['zoom', 'abc', undefined],
    ['zoom', Number.NaN, undefined],
  ])('falls back %s=%o to %o', (key, value, expected) => {
    expect(getSearch({ [key]: value })[key as keyof ReturnType<typeof getSearch>]).toBe(expected);
  });

  it('keeps the other params when one is invalid', () => {
    expect(getSearch({ zoom: 'abc', depth: 'foo', minmag: 5 })).toMatchObject({
      zoom: undefined,
      depth: 'all',
      minmag: 5,
    });
  });

  it('accepts a 120-character place', () => {
    const place = 'x'.repeat(120);
    expect(getSearch({ place, plat: 1, plon: 2 }).place).toBe(place);
  });

  it('drops the place and a half centre when the search centre is incomplete', () => {
    expect(getSearch({ place: 'Granada', plat: 37.17 })).toMatchObject({
      place: undefined,
      plat: undefined,
      plon: undefined,
    });
  });

  it('keeps a centre without a place for my location', () => {
    const search = getSearch({ plat: 37.17, plon: -3.6 });
    expect(search).toMatchObject({ plat: 37.17, plon: -3.6, radius: 100 });
    expect(search.place).toBeUndefined();
  });

  it.each([75, '250', -1])('falls back to the 100 km radius for %s', (radius) => {
    expect(getSearch({ radius }).radius).toBe(100);
  });

  it('accepts the coordinate bounds', () => {
    expect(getSearch({ lat: -90, lon: 180, zoom: 0 })).toMatchObject({
      lat: -90,
      lon: 180,
      zoom: 0,
    });
    expect(getSearch({ lat: 90, lon: -180, zoom: 20 })).toMatchObject({
      lat: 90,
      lon: -180,
      zoom: 20,
    });
  });

  it('rounds lat, lon and zoom to 2 decimals', () => {
    const search = getSearch({ lat: 37.1789, lon: -3.60449, zoom: 3.456 });
    expect(search.lat).toBeCloseTo(37.18, 10);
    expect(search.lon).toBeCloseTo(-3.6, 10);
    expect(search.zoom).toBeCloseTo(3.46, 10);
  });
});

describe('getRoundedCoordinate', () => {
  it('rounds to 2 decimals', () => {
    expect(getRoundedCoordinate(37.1789)).toBeCloseTo(37.18, 10);
    expect(getRoundedCoordinate(12.344)).toBeCloseTo(12.34, 10);
  });
});

describe('EARTHQUAKE_SEARCH_DEFAULTS', () => {
  it('holds exactly the six defaulted params', () => {
    expect(EARTHQUAKE_SEARCH_DEFAULTS).toEqual({
      source: 'emsc',
      interval: '7d',
      minmag: 0,
      depth: 'all',
      radius: 100,
      view: 'map',
    });
  });

  it('matches what the schema fills in', () => {
    expect(getSearch()).toMatchObject(EARTHQUAKE_SEARCH_DEFAULTS);
  });
});

describe('EARTHQUAKE_SEARCH_ROUTE', () => {
  it('validates with the schema', () => {
    expect(EARTHQUAKE_SEARCH_ROUTE.validateSearch).toBe(earthquakeSearchSchema);
  });

  it('strips params equal to their default', () => {
    const [strip] = EARTHQUAKE_SEARCH_ROUTE.search.middlewares;
    const search = getSearch({ interval: '7d', minmag: 5, lat: 10 });
    expect(strip?.({ search, next: (value) => value })).toEqual({
      minmag: 5,
      place: undefined,
      plat: undefined,
      plon: undefined,
      quake: undefined,
      lat: 10,
      lon: undefined,
      zoom: undefined,
    });
  });
});

describe('DEPTH_RANGES_KM', () => {
  it('covers contiguous depth bands', () => {
    expect(DEPTH_RANGES_KM).toEqual({
      shallow: { max: 70 },
      mid: { min: 70, max: 300 },
      deep: { min: 300 },
    });
  });
});

describe('getTimeWindow', () => {
  it.each([
    ['24h', '2026-10-07T12:00:00.000Z'],
    ['3d', '2026-10-05T12:00:00.000Z'],
    ['7d', '2026-10-01T12:00:00.000Z'],
    ['1y', '2025-10-08T12:00:00.000Z'],
  ] as const)('%s starts at %s and ends now', (interval, start) => {
    const window = getTimeWindow({ interval }, NOW.getTime());
    expect(new Date(window.start).toISOString()).toBe(start);
    expect(window.end).toBe(NOW.getTime());
  });

  it('spans whole UTC days for a custom range', () => {
    expect(
      getTimeWindow({ interval: 'custom', from: '2026-09-01', to: '2026-09-30' }, NOW.getTime()),
    ).toEqual({ start: Date.UTC(2026, 8, 1), end: Date.UTC(2026, 9, 1) });
  });
});

describe('getCustomRangeError', () => {
  const now = NOW.getTime();

  it.each([
    [undefined, '2026-10-01', 'missing'],
    ['2026-10-01', '', 'missing'],
    ['2026-02-30', '2026-03-01', 'missing'],
    ['2026-10-02', '2026-10-01', 'order'],
    ['2026-10-01', '2026-10-09', 'future'],
    ['2025-10-01', '2026-10-02', 'span'],
    ['2025-10-08', '2026-10-08', null],
    ['2026-10-08', '2026-10-08', null],
  ] as const)('%s to %s is %s', (from, to, error) => {
    expect(getCustomRangeError(from, to, now)).toBe(error);
  });
});

describe('getDefaultCustomRange', () => {
  it('covers the last 30 days up to today', () => {
    expect(getDefaultCustomRange(NOW.getTime())).toEqual({ from: '2026-09-09', to: '2026-10-08' });
  });
});

describe('getEarthquakeFilters', () => {
  it('keeps only source, interval, minmag and depth', () => {
    const search = getSearch({
      source: 'usgs',
      interval: '24h',
      minmag: 4,
      depth: 'mid',
      place: 'Granada',
      quake: 'usgs:us6000u4j2',
      lat: 10,
      lon: 20,
      zoom: 3,
    });
    expect(getEarthquakeFilters(search)).toStrictEqual({
      source: 'usgs',
      interval: '24h',
      minmag: 4,
      depth: 'mid',
    });
  });
});
