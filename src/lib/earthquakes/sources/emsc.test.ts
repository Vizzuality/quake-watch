import { describe, expect, it } from 'vitest';

import { getEmscFeature } from '@/test/fixtures/earthquakes';

import type { EarthquakeFilters } from '../search-schema';
import { emscAdapter } from './emsc';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const FILTERS: EarthquakeFilters = { source: 'emsc', interval: '7d', minmag: 0, depth: 'all' };

function getQueryUrl(filters: Partial<EarthquakeFilters> = {}): URL {
  return new URL(emscAdapter.getQueryUrl({ ...FILTERS, ...filters }, NOW, 20_000));
}

describe('emscAdapter.getQueryUrl', () => {
  it('queries the EMSC FDSN endpoint with format json first', () => {
    const url = getQueryUrl({ interval: '24h', minmag: 4 });
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.seismicportal.eu/fdsnws/event/1/query',
    );
    expect([...url.searchParams]).toEqual([
      ['format', 'json'],
      ['orderby', 'time'],
      ['limit', '20000'],
      ['minmagnitude', '4'],
      ['starttime', '2026-10-07T12:00:00.000Z'],
    ]);
  });

  it.each([
    ['24h', '2026-10-07T12:00:00.000Z'],
    ['3d', '2026-10-05T12:00:00.000Z'],
    ['7d', '2026-10-01T12:00:00.000Z'],
  ] as const)('sends starttime for %s', (interval, starttime) => {
    expect(getQueryUrl({ interval }).searchParams.get('starttime')).toBe(starttime);
  });

  it.each([
    ['all', null, null],
    ['shallow', null, '70'],
    ['mid', '70', '300'],
    ['deep', '300', null],
  ] as const)('maps depth %s to mindepth %s and maxdepth %s', (depth, mindepth, maxdepth) => {
    const { searchParams } = getQueryUrl({ depth });
    expect(searchParams.has('mindepth')).toBe(mindepth !== null);
    expect(searchParams.has('maxdepth')).toBe(maxdepth !== null);
    expect(searchParams.get('mindepth')).toBe(mindepth);
    expect(searchParams.get('maxdepth')).toBe(maxdepth);
  });
});

describe('emscAdapter.getEarthquake', () => {
  it('normalises an EMSC feature', () => {
    expect(emscAdapter.getEarthquake(getEmscFeature())).toEqual({
      id: '20260814_0000322',
      source: 'emsc',
      magnitude: 5.2,
      magnitudeType: 'mb',
      place: 'Southern Spain',
      time: Date.parse('2026-08-14T23:04:40.18Z'),
      depthKm: 2.1,
      longitude: -3.6316,
      latitude: 37.1147,
      url: 'https://www.seismicportal.eu/eventdetails.html?unid=20260814_0000322',
    });
  });

  it('keeps a missing region as null', () => {
    expect(emscAdapter.getEarthquake(getEmscFeature({ region: null }))?.place).toBeNull();
  });

  it('drops malformed features', () => {
    expect(emscAdapter.getEarthquake({ nope: true })).toBeNull();
    expect(emscAdapter.getEarthquake({ ...getEmscFeature(), geometry: null })).toBeNull();
  });
});
