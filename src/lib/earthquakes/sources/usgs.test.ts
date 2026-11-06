import { describe, expect, it } from 'vitest';

import { getUsgsFeature } from '@/test/fixtures/earthquakes';

import type { EarthquakeFilters } from '../search-schema';
import { usgsAdapter } from './usgs';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const FILTERS: EarthquakeFilters = { source: 'usgs', interval: '7d', minmag: 0, depth: 'all' };

function getQueryUrl(filters: Partial<EarthquakeFilters> = {}): URL {
  return new URL(usgsAdapter.getQueryUrl({ ...FILTERS, ...filters }, NOW, 20_000));
}

describe('usgsAdapter.getQueryUrl', () => {
  it('queries the USGS FDSN endpoint with format geojson first', () => {
    const url = getQueryUrl({ interval: '24h', minmag: 4 });
    expect(`${url.origin}${url.pathname}`).toBe('https://earthquake.usgs.gov/fdsnws/event/1/query');
    expect([...url.searchParams]).toEqual([
      ['format', 'geojson'],
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

describe('usgsAdapter.getEarthquake', () => {
  it('normalises a USGS feature', () => {
    expect(usgsAdapter.getEarthquake(getUsgsFeature())).toEqual({
      id: 'us6000tkv2',
      source: 'usgs',
      magnitude: 5.2,
      magnitudeType: 'mww',
      place: '1 km W of Alhendín, Spain',
      time: 1_786_748_680_180,
      depthKm: 9.8,
      longitude: -3.65,
      latitude: 37.13,
      url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us6000tkv2',
    });
  });

  it('keeps a null place as null and drops a null magnitude', () => {
    expect(usgsAdapter.getEarthquake(getUsgsFeature({ place: null }))?.place).toBeNull();
    expect(usgsAdapter.getEarthquake(getUsgsFeature({ mag: null }))).toBeNull();
  });

  it('drops out-of-range coordinates', () => {
    const feature = getUsgsFeature();
    expect(
      usgsAdapter.getEarthquake({
        ...feature,
        geometry: { type: 'Point', coordinates: [200, 95, 2] },
      }),
    ).toBeNull();
  });

  it('drops an event url that is not https', () => {
    const feature = getUsgsFeature();
    const getFeatureWithUrl = (url: string) => ({
      ...feature,
      properties: { ...feature.properties, url },
    });
    expect(usgsAdapter.getEarthquake(getFeatureWithUrl('javascript:alert(1)'))).toBeNull();
    expect(usgsAdapter.getEarthquake(getFeatureWithUrl('http://earthquake.usgs.gov/x'))).toBeNull();
  });
});
