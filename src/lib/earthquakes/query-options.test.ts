import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getEmscFeature, getFeatureCollection, getUsgsFeature } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

import {
  ARCHIVE_STALE_MS,
  EARTHQUAKE_LIMIT,
  earthquakesQueryOptions,
  getEarthquakes,
  getEarthquakesQueryKey,
  LIVE_REFETCH_MS,
  LIVE_STALE_MS,
} from './query-options';
import { earthquakeSearchSchema } from './search-schema';
import { EarthquakeSourceError } from './sources/source-error';

const NOW = new Date('2026-10-08T12:00:00.000Z');

function getSearch(input: Record<string, unknown> = {}) {
  return earthquakeSearchSchema.parse(input);
}

function getClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function getSignal() {
  return new AbortController().signal;
}

function stubResponse(respond: () => Response) {
  return stubFetch([{ match: () => true, respond }]);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('getEarthquakesQueryKey', () => {
  it('holds only the four filters', () => {
    expect(
      getEarthquakesQueryKey(
        getSearch({
          source: 'usgs',
          interval: '24h',
          minmag: 4,
          depth: 'deep',
          place: 'Granada',
          quake: 'usgs:us6000u4j2',
          lat: 37.17,
          lon: -3.6,
          zoom: 4,
        }),
      ),
    ).toStrictEqual(['earthquakes', { source: 'usgs', interval: '24h', minmag: 4, depth: 'deep' }]);
  });

  it('ignores camera, place and quake', () => {
    expect(
      getEarthquakesQueryKey(
        getSearch({ lat: 10, lon: 20, zoom: 3, place: 'Lima', quake: 'emsc:20261013_0000326' }),
      ),
    ).toStrictEqual(getEarthquakesQueryKey(getSearch()));
  });

  it.each([{ source: 'usgs' }, { interval: '24h' }, { minmag: 4 }, { depth: 'mid' }])(
    'changes with %o',
    (input) => {
      expect(getEarthquakesQueryKey(getSearch(input))).not.toEqual(
        getEarthquakesQueryKey(getSearch()),
      );
    },
  );
});

describe('earthquakesQueryOptions', () => {
  it('keys on the filters of a full search', () => {
    const search = getSearch({ interval: '3d', lat: 10, lon: 20, zoom: 3, place: 'Lima' });
    expect(earthquakesQueryOptions(search).queryKey).toStrictEqual([
      'earthquakes',
      { source: 'emsc', interval: '3d', minmag: 0, depth: 'all' },
    ]);
  });

  it.each([
    ['24h', LIVE_REFETCH_MS, LIVE_STALE_MS],
    ['3d', false, ARCHIVE_STALE_MS],
    ['7d', false, ARCHIVE_STALE_MS],
  ] as const)('%s refetches every %s ms and stays fresh %s ms', (interval, refetch, stale) => {
    const options = earthquakesQueryOptions(getSearch({ interval }));
    expect(options.refetchInterval).toBe(refetch);
    expect(options.staleTime).toBe(stale);
  });

  it('uses 60 s polling, 30 s live and 5 min archive staleness', () => {
    expect([LIVE_REFETCH_MS, LIVE_STALE_MS, ARCHIVE_STALE_MS]).toEqual([60_000, 30_000, 300_000]);
  });

  it('fetches only from the filters, forwarding the abort signal', async () => {
    const fetchMock = stubResponse(() => Response.json(getFeatureCollection([getEmscFeature()])));
    const search = getSearch({ depth: 'deep', lat: 10, lon: 20, zoom: 3, place: 'Lima' });
    const result = await getClient().fetchQuery(earthquakesQueryOptions(search));
    expect(result.earthquakes).toHaveLength(1);
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(url.searchParams.get('mindepth')).toBe('300');
    expect(['lat', 'lon', 'zoom', 'place'].filter((key) => url.searchParams.has(key))).toEqual([]);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('getEarthquakes', () => {
  it.each([
    ['emsc', 'www.seismicportal.eu', getEmscFeature(), 'json'],
    ['usgs', 'earthquake.usgs.gov', getUsgsFeature(), 'geojson'],
  ] as const)('fetches %s and normalises its features', async (source, host, feature, format) => {
    const fetchMock = stubFetch([
      {
        match: (url) => url.hostname === host,
        respond: () => Response.json(getFeatureCollection([feature])),
      },
    ]);
    const result = await getEarthquakes(getSearch({ source }), getSignal());
    expect(result.earthquakes).toEqual([expect.objectContaining({ source })]);
    expect(result.isTruncated).toBe(false);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get('format')).toBe(format);
    expect(url.searchParams.get('limit')).toBe(String(EARTHQUAKE_LIMIT));
  });

  it('builds the request and stamps the result from the same now', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const fetchMock = stubResponse(() => new Response(null, { status: 204 }));
    const result = await getEarthquakes(getSearch({ interval: '24h' }), getSignal());
    expect(result.fetchedAt).toBe(NOW.getTime());
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get('starttime')).toBe('2026-10-07T12:00:00.000Z');
  });

  it('treats a 204 as no earthquakes', async () => {
    stubResponse(() => new Response(null, { status: 204 }));
    expect(await getEarthquakes(getSearch(), getSignal())).toMatchObject({
      earthquakes: [],
      isTruncated: false,
    });
  });

  it.each([
    ['emsc', 503],
    ['usgs', 400],
  ] as const)('throws a %s source error with status %s', async (source, status) => {
    stubResponse(() => new Response(null, { status }));
    const error = await getEarthquakes(getSearch({ source }), getSignal()).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(EarthquakeSourceError);
    expect(error).toMatchObject({ source, status });
  });

  it('drops malformed features', async () => {
    stubResponse(() =>
      Response.json(
        getFeatureCollection([getUsgsFeature(), { nope: true }, getUsgsFeature({ mag: null })]),
      ),
    );
    const result = await getEarthquakes(getSearch({ source: 'usgs' }), getSignal());
    expect(result.earthquakes).toHaveLength(1);
  });

  it('flags a result that hit the limit, counting raw features', async () => {
    const feature = getUsgsFeature();
    const features = Array.from({ length: EARTHQUAKE_LIMIT }, () => feature);
    features[0] = getUsgsFeature({ mag: null });
    stubResponse(() => Response.json(getFeatureCollection(features)));
    const result = await getEarthquakes(getSearch({ source: 'usgs' }), getSignal());
    expect(result.earthquakes).toHaveLength(EARTHQUAKE_LIMIT - 1);
    expect(result.isTruncated).toBe(true);
  });

  it('does not flag a result one feature under the limit', async () => {
    const features = Array.from({ length: EARTHQUAKE_LIMIT - 1 }, () => getEmscFeature());
    stubResponse(() => Response.json(getFeatureCollection(features)));
    const result = await getEarthquakes(getSearch(), getSignal());
    expect(result.isTruncated).toBe(false);
  });
});
