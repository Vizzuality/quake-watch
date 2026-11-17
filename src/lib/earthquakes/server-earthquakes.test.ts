import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

import { PAGE_FETCH_TIMEOUT_MS } from './details/detail-fetch-policy';
import { ARCHIVE_STALE_MS, earthquakesQueryOptions } from './query-options';
import { earthquakeSearchSchema } from './search-schema';

const FILTERS = earthquakeSearchSchema.parse({});
const NOW = new Date('2026-11-17T12:00:00.000Z');

let serverModule: typeof import('./server-earthquakes');

function stubList(respond: () => Response | Promise<Response> = () => getListResponse()) {
  return stubFetch([{ match: () => true, respond }]);
}

function getListResponse(id = 'a') {
  return Response.json(getFeatureCollection([getEmscFeature({ id })]));
}

function getSignal() {
  return new AbortController().signal;
}

beforeEach(async () => {
  vi.resetModules();
  serverModule = await import('./server-earthquakes');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('prefetchServerEarthquakes', () => {
  it('seeds the list query with its fetch time so the client does not refetch it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    stubList();
    const queryClient = new QueryClient();

    await serverModule.prefetchServerEarthquakes(queryClient, FILTERS);

    const { queryKey } = earthquakesQueryOptions(FILTERS);
    expect(queryClient.getQueryData(queryKey)?.earthquakes.map(({ id }) => id)).toEqual(['a']);
    expect(queryClient.getQueryState(queryKey)?.dataUpdatedAt).toBe(NOW.getTime());
  });

  it('leaves the list to the client when the agency is down', async () => {
    stubList(() => new Response(null, { status: 503 }));
    const queryClient = new QueryClient();

    await serverModule.prefetchServerEarthquakes(queryClient, FILTERS);

    expect(queryClient.getQueryState(earthquakesQueryOptions(FILTERS).queryKey)).toBeUndefined();
  });

  it('gives up on the page after the page timeout and serves the late list next time', async () => {
    const slowMs = PAGE_FETCH_TIMEOUT_MS + 300;
    const fetchMock = stubList(
      () =>
        new Promise<Response>((resolve) => setTimeout(() => resolve(getListResponse()), slowMs)),
    );
    const queryClient = new QueryClient();
    const startedAt = Date.now();

    await serverModule.prefetchServerEarthquakes(queryClient, FILTERS);

    expect(Date.now() - startedAt).toBeLessThan(slowMs);
    expect(queryClient.getQueryState(earthquakesQueryOptions(FILTERS).queryKey)).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, slowMs - PAGE_FETCH_TIMEOUT_MS + 50));
    await serverModule.prefetchServerEarthquakes(queryClient, FILTERS);
    expect(queryClient.getQueryData(earthquakesQueryOptions(FILTERS).queryKey)).toBeDefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does nothing in the browser', async () => {
    vi.resetModules();
    vi.doMock('@/paraglide/runtime', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      isServer: false,
    }));
    const fetchMock = stubList();
    const browser = await import('./server-earthquakes');

    await browser.prefetchServerEarthquakes(new QueryClient(), FILTERS);

    expect(fetchMock).not.toHaveBeenCalled();
    vi.doUnmock('@/paraglide/runtime');
  });
});

describe('getServerEarthquakes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  it('shares one upstream request between pages while the list is fresh', async () => {
    const fetchMock = stubList();

    const [first, second] = await Promise.all([
      serverModule.getServerEarthquakes(FILTERS, getSignal()),
      serverModule.getServerEarthquakes(FILTERS, getSignal()),
    ]);
    vi.setSystemTime(NOW.getTime() + ARCHIVE_STALE_MS / 2 - 1);
    const third = await serverModule.getServerEarthquakes(FILTERS, getSignal());

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('serves the ageing list while it refreshes it in the background', async () => {
    const fetchMock = stubList();
    const first = await serverModule.getServerEarthquakes(FILTERS, getSignal());
    fetchMock.mockImplementation(async () => getListResponse('b'));
    vi.setSystemTime(NOW.getTime() + ARCHIVE_STALE_MS / 2);

    const ageing = await serverModule.getServerEarthquakes(FILTERS, getSignal());
    await vi.waitFor(async () => {
      const next = await serverModule.getServerEarthquakes(FILTERS, getSignal());
      expect(next.earthquakes[0]?.id).toBe('b');
    });

    expect(ageing).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('waits for a new list once the cached one is stale', async () => {
    const fetchMock = stubList();
    await serverModule.getServerEarthquakes(FILTERS, getSignal());
    fetchMock.mockImplementation(async () => getListResponse('b'));
    vi.setSystemTime(NOW.getTime() + ARCHIVE_STALE_MS);

    const next = await serverModule.getServerEarthquakes(FILTERS, getSignal());

    expect(next.earthquakes[0]?.id).toBe('b');
  });
});
