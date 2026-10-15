import { describe, expect, it } from 'vitest';

import { getEarthquakeDetailLinkOptions } from './detail-link';

describe('getEarthquakeDetailLinkOptions', () => {
  it('links a USGS Earthquake to its USGS detail route', () => {
    expect(getEarthquakeDetailLinkOptions({ id: 'us7000abcd', source: 'usgs' })).toEqual({
      to: '/earthquakes/usgs/$earthquakeId',
      params: { earthquakeId: 'us7000abcd' },
    });
  });

  it('links an EMSC Earthquake to its EMSC detail route', () => {
    expect(getEarthquakeDetailLinkOptions({ id: '20260814_0000123', source: 'emsc' })).toEqual({
      to: '/earthquakes/emsc/$earthquakeId',
      params: { earthquakeId: '20260814_0000123' },
    });
  });
});
