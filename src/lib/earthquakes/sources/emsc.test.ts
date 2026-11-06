import { describe, expect, it } from 'vitest';

import { getEmscFeature } from '@/test/fixtures/earthquakes';

import { emscAdapter } from './emsc';

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
