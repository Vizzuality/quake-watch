import { describe, expect, it } from 'vitest';

import { getUsgsFeature } from '@/test/fixtures/earthquakes';

import { usgsAdapter } from './usgs';

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
