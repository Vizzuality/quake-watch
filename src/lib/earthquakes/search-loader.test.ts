import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch, stubHangingFetch } from '@/test/stub-fetch';

import { getEarthquakesQueryKey } from './query-options';
import { earthquakeSearchSchema } from './search-schema';

const runtime = vi.hoisted(() => ({ isServer: true }));

vi.mock('@/paraglide/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/paraglide/runtime')>()),
  get isServer() {
    return runtime.isServer;
  },
}));

const SEARCH = earthquakeSearchSchema.parse({});
const QUERY_KEY = getEarthquakesQueryKey(SEARCH);

let seedSearchQuery: typeof import('./search-loader').seedSearchQuery;

function stubEmsc(respond: () => Response) {
  return stubFetch([{ match: (url) => url.hostname === 'www.seismicportal.eu', respond }]);
}

describe('seedSearchQuery', () => {
  beforeEach(async () => {
    runtime.isServer = true;
    vi.resetModules();
    ({ seedSearchQuery } = await import('./search-loader'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('seeds the query with the server fetch and its fetch time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubEmsc(() => Response.json(getFeatureCollection([getEmscFeature()])));
    const firstClient = new QueryClient();
    await seedSearchQuery(firstClient, SEARCH);
    const firstFetchedAt = firstClient.getQueryData<{ fetchedAt: number }>(QUERY_KEY)?.fetchedAt;

    vi.setSystemTime(Date.now() + 30_000);
    const client = new QueryClient();
    await seedSearchQuery(client, SEARCH);
    const data = client.getQueryData<{ earthquakes: unknown[] }>(QUERY_KEY);
    const state = client.getQueryState(QUERY_KEY);
    expect(data?.earthquakes).toHaveLength(1);
    expect(state?.dataUpdatedAt).toBe(firstFetchedAt);
    expect(state?.dataUpdatedAt).not.toBe(Date.now());
  });

  it('leaves the query empty when the agency is down', async () => {
    stubEmsc(() => new Response(null, { status: 503 }));
    const client = new QueryClient();
    await expect(seedSearchQuery(client, SEARCH)).resolves.toBeUndefined();
    expect(client.getQueryData(QUERY_KEY)).toBeUndefined();
  });

  it('gives up after the server timeout', async () => {
    stubHangingFetch();
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(AbortSignal.abort(new DOMException('Timed out', 'TimeoutError')));
    const client = new QueryClient();
    await expect(seedSearchQuery(client, SEARCH)).resolves.toBeUndefined();
    expect(timeout).toHaveBeenCalledWith(4_000);
    expect(client.getQueryData(QUERY_KEY)).toBeUndefined();
  });

  it('does not fetch in the browser', async () => {
    runtime.isServer = false;
    const fetchMock = stubEmsc(() => Response.json(getFeatureCollection([])));
    const client = new QueryClient();
    await seedSearchQuery(client, SEARCH);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.getQueryData(QUERY_KEY)).toBeUndefined();
  });
});
