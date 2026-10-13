import { describe, expect, it } from 'vitest';

import { getEmscFeature } from '@/test/fixtures/earthquakes';

import { earthquakeSearchSchema } from '../search-schema';
import { emscAdapter } from './emsc';

const NOW = new Date('2026-10-08T12:00:00.000Z');

describe('emscAdapter.getQueryUrl', () => {
  it('builds a worldwide query', () => {
    const url = new URL(emscAdapter.getQueryUrl(earthquakeSearchSchema.parse({}), NOW, 1000));
    expect(url.origin + url.pathname).toBe('https://www.seismicportal.eu/fdsnws/event/1/query');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      format: 'json',
      orderby: 'time',
      limit: '1000',
      minmag: '2.5',
      start: '2026-10-07T12:00:00.000Z',
    });
  });

  it('converts the radius to degrees and adds the end of a custom range', () => {
    const search = earthquakeSearchSchema.parse({
      lat: 37.17,
      lon: -3.6,
      radius: 100,
      period: 'custom',
      from: '2026-08-14',
      to: '2026-08-16',
    });
    const params = new URL(emscAdapter.getQueryUrl(search, NOW, 1000)).searchParams;
    expect(params.get('lat')).toBe('37.17');
    expect(params.get('lon')).toBe('-3.6');
    expect(Number(params.get('maxradius'))).toBeCloseTo(0.8993, 4);
    expect(params.get('end')).toBe('2026-08-16T23:59:59.999Z');
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
