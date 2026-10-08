import { afterEach, describe, expect, it, vi } from 'vitest';

import { getEarthquakesFromFeed, getLatestEarthquakes, USGS_FEED_URL } from '@/earthquakes/feed';

function makeFeature(overrides: Record<string, unknown> = {}) {
  return {
    type: 'Feature',
    id: 'us1',
    geometry: { type: 'Point', coordinates: [-122.5, 37.8, 10.2] },
    properties: {
      mag: 4.5,
      place: '5 km N of Somewhere',
      time: 1_700_000_000_000,
      url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us1',
    },
    ...overrides,
  };
}

function makeCollection(features: unknown[]) {
  return { type: 'FeatureCollection', features };
}

describe('getEarthquakesFromFeed', () => {
  it('maps a valid feature to an Earthquake', () => {
    expect(getEarthquakesFromFeed(makeCollection([makeFeature()]))).toEqual([
      {
        id: 'us1',
        magnitude: 4.5,
        place: '5 km N of Somewhere',
        time: 1_700_000_000_000,
        depthKm: 10.2,
        longitude: -122.5,
        latitude: 37.8,
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us1',
      },
    ]);
  });

  it('drops features with null magnitude', () => {
    const feature = makeFeature({
      properties: { mag: null, place: 'x', time: 1, url: 'u' },
    });
    expect(getEarthquakesFromFeed(makeCollection([feature]))).toEqual([]);
  });

  it('drops features with null geometry', () => {
    expect(getEarthquakesFromFeed(makeCollection([makeFeature({ geometry: null })]))).toEqual([]);
  });

  it('drops features with non-finite coordinates', () => {
    const feature = makeFeature({ geometry: { type: 'Point', coordinates: ['a', 1, 2] } });
    expect(getEarthquakesFromFeed(makeCollection([feature]))).toEqual([]);
  });

  it('drops features with out-of-range coordinates', () => {
    const feature = makeFeature({ geometry: { type: 'Point', coordinates: [200, 95, 2] } });
    expect(getEarthquakesFromFeed(makeCollection([feature]))).toEqual([]);
  });

  it('drops features with a malformed shape', () => {
    expect(getEarthquakesFromFeed(makeCollection([{ nope: true }, 42]))).toEqual([]);
  });

  it('falls back to Unknown location when place is null', () => {
    const feature = makeFeature({
      properties: { mag: 3, place: null, time: 1, url: 'u' },
    });
    expect(getEarthquakesFromFeed(makeCollection([feature]))[0]?.place).toBe('Unknown location');
  });

  it('returns an empty array for no features', () => {
    expect(getEarthquakesFromFeed(makeCollection([]))).toEqual([]);
  });

  it('throws when the payload is not a FeatureCollection', () => {
    expect(() => getEarthquakesFromFeed({ type: 'Feature' })).toThrow(/FeatureCollection/);
    expect(() => getEarthquakesFromFeed(null)).toThrow(/expected object/);
  });
});

describe('getLatestEarthquakes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the USGS feed and parses it', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(makeCollection([makeFeature()])));
    vi.stubGlobal('fetch', fetchMock);

    const quakes = await getLatestEarthquakes();

    expect(fetchMock).toHaveBeenCalledWith(USGS_FEED_URL);
    expect(quakes).toHaveLength(1);
  });

  it('throws with the status when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
    );

    await expect(getLatestEarthquakes()).rejects.toThrow('503');
  });
});
