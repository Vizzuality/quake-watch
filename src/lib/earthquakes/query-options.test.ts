import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { getEmscFeature, getFeatureCollection, getUsgsFeature } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

import {
  EarthquakeSourceError,
  EARTHQUAKE_LIMIT,
  earthquakesQueryOptions,
  getEarthquakesQueryKey,
} from './query-options';
import { earthquakeSearchSchema } from './search-schema';

function getSearch(input: Record<string, unknown> = {}) {
  return earthquakeSearchSchema.parse(input);
}

function getClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('getEarthquakesQueryKey', () => {
  it('ignores sort and page', () => {
    expect(getEarthquakesQueryKey(getSearch({ sort: 'magnitude.asc', page: 4 }))).toEqual(
      getEarthquakesQueryKey(getSearch()),
    );
  });

  it('ignores t and window', () => {
    expect(
      getEarthquakesQueryKey(getSearch({ t: '2026-10-08T12:00:00.000Z', window: '7d' })),
    ).toEqual(getEarthquakesQueryKey(getSearch()));
  });

  it('changes with source and filters', () => {
    const base = getEarthquakesQueryKey(getSearch());
    expect(getEarthquakesQueryKey(getSearch({ source: 'usgs' }))).not.toEqual(base);
    expect(getEarthquakesQueryKey(getSearch({ minmag: 4 }))).not.toEqual(base);
  });
});

describe('earthquakesQueryOptions', () => {
  it('refetches every minute only for the last 24 h', () => {
    expect(earthquakesQueryOptions(getSearch()).refetchInterval).toBe(60_000);
    expect(earthquakesQueryOptions(getSearch({ period: '7d' })).refetchInterval).toBe(false);
  });

  it('fetches EMSC, forwards the abort signal and parses the result', async () => {
    const fetchMock = stubFetch([
      {
        match: (url) => url.hostname === 'www.seismicportal.eu',
        respond: () => Response.json(getFeatureCollection([getEmscFeature()])),
      },
    ]);
    const result = await getClient().fetchQuery(earthquakesQueryOptions(getSearch()));
    expect(result.earthquakes).toHaveLength(1);
    expect(result.isTruncated).toBe(false);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('treats an EMSC 204 as no earthquakes', async () => {
    stubFetch([{ match: () => true, respond: () => new Response(null, { status: 204 }) }]);
    expect(await getClient().fetchQuery(earthquakesQueryOptions(getSearch()))).toEqual({
      earthquakes: [],
      isTruncated: false,
    });
  });

  it('flags a result that hit the limit, counting raw features', async () => {
    const features = Array.from({ length: EARTHQUAKE_LIMIT }, (_, index) =>
      getUsgsFeature({ id: `us${index}`, mag: index === 0 ? null : 3 }),
    );
    stubFetch([
      {
        match: (url) => url.hostname === 'earthquake.usgs.gov',
        respond: () => Response.json(getFeatureCollection(features)),
      },
    ]);
    const result = await getClient().fetchQuery(
      earthquakesQueryOptions(getSearch({ source: 'usgs' })),
    );
    expect(result.earthquakes).toHaveLength(EARTHQUAKE_LIMIT - 1);
    expect(result.isTruncated).toBe(true);
  });

  it('throws a source error with the status', async () => {
    stubFetch([{ match: () => true, respond: () => new Response(null, { status: 503 }) }]);
    const error = await getClient()
      .fetchQuery(earthquakesQueryOptions(getSearch()))
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(EarthquakeSourceError);
    expect(error).toMatchObject({ source: 'emsc', status: 503 });
  });
});
