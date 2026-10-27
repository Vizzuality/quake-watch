import { QueryClient } from '@tanstack/react-query';
import { isNotFound } from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usgsPanamaDetail } from '@/test/fixtures/usgs-detail';
import { stubFetch } from '@/test/stub-fetch';

import { getDetailLoaderData } from './detail-loader';
import { usgsEarthquakeDetailQueryOptions } from './usgs-query-options';

const runtime = vi.hoisted(() => ({ isServer: false }));

vi.mock('@/paraglide/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/paraglide/runtime')>()),
  get isServer() {
    return runtime.isServer;
  },
}));

function getClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function stubUsgs(respond: () => Response) {
  return stubFetch([{ match: (url) => url.hostname === 'earthquake.usgs.gov', respond }]);
}

describe('getDetailLoaderData on the server', () => {
  beforeEach(() => {
    runtime.isServer = true;
  });

  it('waits for the Earthquake and returns it for the head', async () => {
    stubUsgs(() => Response.json(usgsPanamaDetail));
    const client = getClient();
    const options = usgsEarthquakeDetailQueryOptions('us6000u18k');
    const data = await getDetailLoaderData(client, options);
    expect(data.earthquake).toMatchObject({
      id: 'us6000u18k',
      place: expect.stringMatching(/Pitaloza Arriba/),
    });
    expect(client.getQueryData(options.queryKey)).not.toBeUndefined();
  });

  it('throws a router not-found for an unknown id', async () => {
    stubUsgs(() => new Response(null, { status: 404 }));
    const pending = getDetailLoaderData(
      getClient(),
      usgsEarthquakeDetailQueryOptions('doesnotexist123'),
    );
    await expect(pending).rejects.toSatisfy(isNotFound);
  });

  it('lets an upstream failure reach the route error boundary', async () => {
    stubUsgs(() => new Response(null, { status: 503 }));
    const pending = getDetailLoaderData(
      getClient(),
      usgsEarthquakeDetailQueryOptions('us6000u18k'),
    );
    await expect(pending).rejects.toThrow(/usgs/i);
  });
});

describe('getDetailLoaderData in the browser', () => {
  beforeEach(() => {
    runtime.isServer = false;
  });

  it('starts the fetch without waiting so the page can show its own states', async () => {
    const fetchMock = stubUsgs(() => Response.json(usgsPanamaDetail));
    const client = getClient();
    const options = usgsEarthquakeDetailQueryOptions('us6000u18k');
    const data = await getDetailLoaderData(client, options);
    expect(data.earthquake).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('hands a cached Earthquake to the head', async () => {
    stubUsgs(() => Response.json(usgsPanamaDetail));
    const client = getClient();
    const options = usgsEarthquakeDetailQueryOptions('us6000u18k');
    await client.fetchQuery(options);
    const data = await getDetailLoaderData(client, options);
    expect(data.earthquake?.id).toBe('us6000u18k');
  });
});
