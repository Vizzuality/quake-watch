import { describe, expect, it } from 'vitest';

import { getUsgsFeature } from '@/test/fixtures/earthquakes';

import { earthquakeSearchSchema } from '../search-schema';
import { usgsAdapter } from './usgs';

const NOW = new Date('2026-10-08T12:00:00.000Z');

describe('usgsAdapter.getQueryUrl', () => {
  it('builds a radius query in km', () => {
    const search = earthquakeSearchSchema.parse({
      source: 'usgs',
      lat: 37.17,
      lon: -3.6,
      radius: 250,
      period: '7d',
      minmag: 0,
    });
    const url = new URL(usgsAdapter.getQueryUrl(search, NOW, 1000));
    expect(url.origin + url.pathname).toBe('https://earthquake.usgs.gov/fdsnws/event/1/query');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      format: 'geojson',
      orderby: 'time',
      limit: '1000',
      minmagnitude: '0',
      starttime: '2026-10-01T12:00:00.000Z',
      latitude: '37.17',
      longitude: '-3.6',
      maxradiuskm: '250',
    });
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
