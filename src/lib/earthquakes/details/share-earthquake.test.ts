import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { getEmscDetailFeature } from '@/test/fixtures/emsc-detail';
import { usgsPanamaDetail } from '@/test/fixtures/usgs-detail';
import { stubFetch } from '@/test/stub-fetch';

import { PAGE_FETCH_TIMEOUT_MS, SERVER_FETCH_TIMEOUT_MS } from './detail-fetch-policy';
import { getServerDetail } from './detail-server-cache';
import { earthquakeDetailQueryOptions } from './query-options';
import { getShareEarthquake, getShareQuake, getShareQuakeFromMatches } from './share-earthquake';
import { getUsgsEarthquakeDetail } from './usgs';

function stubSourceResponses(respond: () => Response | Promise<Response>) {
  return stubFetch([
    {
      match: (url) =>
        url.hostname === 'www.seismicportal.eu' || url.hostname === 'earthquake.usgs.gov',
      respond,
    },
  ]);
}

describe('getShareEarthquake on the server', () => {
  it('returns undefined without fetching when there is no valid quake', async () => {
    const fetchMock = stubSourceResponses(() => Response.json({}));
    const queryClient = new QueryClient();

    await expect(getShareEarthquake(queryClient, undefined)).resolves.toBeUndefined();
    await expect(getShareEarthquake(queryClient, 'isc:123')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads a USGS quake and seeds the detail query for the client', async () => {
    stubSourceResponses(() => Response.json(usgsPanamaDetail));
    const queryClient = new QueryClient();

    const earthquake = await getShareEarthquake(queryClient, 'usgs:us6000u18k');

    expect(earthquake?.id).toBe('us6000u18k');
    expect(earthquake?.magnitude).toBe(7.7);
    expect(
      queryClient.getQueryData(earthquakeDetailQueryOptions('usgs:us6000u18k').queryKey)?.source,
    ).toBe('usgs');
  });

  it('loads an EMSC quake', async () => {
    stubSourceResponses(() => Response.json(getEmscDetailFeature({ id: '20261013_0000999' })));

    const earthquake = await getShareEarthquake(new QueryClient(), 'emsc:20261013_0000999');

    expect(earthquake?.id).toBe('20261013_0000999');
    expect(earthquake?.source).toBe('emsc');
  });

  it('returns undefined for an unknown quake', async () => {
    stubSourceResponses(() => new Response(null, { status: 404 }));

    await expect(getShareEarthquake(new QueryClient(), 'usgs:unknown404')).resolves.toBeUndefined();
  });

  it('returns undefined and drops the failed query when the source is down', async () => {
    stubSourceResponses(() => new Response(null, { status: 503 }));
    const queryClient = new QueryClient();

    await expect(getShareEarthquake(queryClient, 'usgs:down503')).resolves.toBeUndefined();
    expect(
      queryClient.getQueryState(earthquakeDetailQueryOptions('usgs:down503').queryKey),
    ).toBeUndefined();
  });

  it(
    'gives up on the page after the page timeout while the image keeps waiting',
    async () => {
      const slowMs = PAGE_FETCH_TIMEOUT_MS + 500;
      stubSourceResponses(
        () =>
          new Promise<Response>((resolve) => {
            setTimeout(() => resolve(Response.json(usgsPanamaDetail)), slowMs);
          }),
      );
      const startedAt = Date.now();

      await expect(getShareEarthquake(new QueryClient(), 'usgs:slow1')).resolves.toBeUndefined();
      expect(Date.now() - startedAt).toBeLessThan(slowMs);

      const detail = await getServerDetail('usgs', 'slow1', getUsgsEarthquakeDetail);
      expect(detail?.earthquake.id).toBe('us6000u18k');
    },
    SERVER_FETCH_TIMEOUT_MS,
  );
});

describe('getShareEarthquake in the browser', () => {
  it('reads the cached detail without fetching', async () => {
    vi.resetModules();
    vi.doMock('@/paraglide/runtime', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      isServer: false,
    }));
    const fetchMock = stubSourceResponses(() => Response.json(usgsPanamaDetail));
    const browser = await import('./share-earthquake');
    const queryClient = new QueryClient();

    await expect(
      browser.getShareEarthquake(queryClient, 'usgs:us6000u18k'),
    ).resolves.toBeUndefined();

    const detail = await queryClient.fetchQuery(earthquakeDetailQueryOptions('usgs:us6000u18k'));
    fetchMock.mockClear();
    await expect(browser.getShareEarthquake(queryClient, 'usgs:us6000u18k')).resolves.toBe(
      detail?.detail.earthquake,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.doUnmock('@/paraglide/runtime');
  });
});

describe('getShareQuake', () => {
  it('joins source and id', () => {
    expect(getShareQuake({ source: 'emsc', id: '20261013_0000326' })).toBe('emsc:20261013_0000326');
  });

  it('returns undefined without an earthquake', () => {
    expect(getShareQuake(undefined)).toBeUndefined();
  });
});

describe('getShareQuakeFromMatches', () => {
  it('reads the shared quake from the home match', () => {
    expect(
      getShareQuakeFromMatches([
        { routeId: '__root__', loaderData: undefined },
        { routeId: '/', loaderData: { earthquake: { source: 'usgs', id: 'us6000u18k' } } },
      ]),
    ).toBe('usgs:us6000u18k');
  });

  it('returns undefined when the home match has no earthquake or is absent', () => {
    expect(
      getShareQuakeFromMatches([{ routeId: '/', loaderData: { earthquake: undefined } }]),
    ).toBeUndefined();
    expect(
      getShareQuakeFromMatches([{ routeId: '__root__', loaderData: undefined }]),
    ).toBeUndefined();
  });
});
