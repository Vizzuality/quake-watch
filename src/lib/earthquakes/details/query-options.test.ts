import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { getEmscDetailFeature } from '@/test/fixtures/emsc-detail';
import { usgsPanamaDetail } from '@/test/fixtures/usgs-detail';
import { stubFetch } from '@/test/stub-fetch';

import { EarthquakeSourceError } from '../sources/source-error';
import { earthquakeDetailQueryOptions, getDetailEarthquake, getQuakeRef } from './query-options';

const EMSC_QUAKE = 'emsc:20261013_0000326';
const USGS_QUAKE = 'usgs:us6000u18k';

function getQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function stubSourceResponses(respond: () => Response) {
  return stubFetch([
    {
      match: (url) =>
        url.hostname === 'www.seismicportal.eu' || url.hostname === 'earthquake.usgs.gov',
      respond,
    },
  ]);
}

function getRequestedUrl(fetchMock: ReturnType<typeof stubFetch>): URL {
  return new URL(String(fetchMock.mock.calls[0]?.[0]));
}

describe('getQuakeRef', () => {
  it('splits source and id at the first colon', () => {
    expect(getQuakeRef(EMSC_QUAKE)).toEqual({ source: 'emsc', id: '20261013_0000326' });
    expect(getQuakeRef(USGS_QUAKE)).toEqual({ source: 'usgs', id: 'us6000u18k' });
  });

  it('returns null for refs that fail the quake pattern', () => {
    expect(getQuakeRef('')).toBeNull();
    expect(getQuakeRef('isc:123')).toBeNull();
    expect(getQuakeRef('usgs:')).toBeNull();
    expect(getQuakeRef('usgs:a:b')).toBeNull();
  });
});

describe('earthquakeDetailQueryOptions', () => {
  it('keys the query by quake only, with a 5 minute stale time', () => {
    const options = earthquakeDetailQueryOptions(USGS_QUAKE);
    expect(options.queryKey).toEqual(['earthquake', USGS_QUAKE]);
    expect(options.staleTime).toBe(5 * 60_000);
  });

  it('fetches an EMSC detail by event id', async () => {
    const fetchMock = stubSourceResponses(() => Response.json(getEmscDetailFeature()));
    const result = await getQueryClient().fetchQuery(earthquakeDetailQueryOptions(EMSC_QUAKE));
    expect(result?.source).toBe('emsc');
    expect(result?.detail.earthquake.id).toBe('20261013_0000326');
    const url = getRequestedUrl(fetchMock);
    expect(url.hostname).toBe('www.seismicportal.eu');
    expect(url.searchParams.get('eventid')).toBe('20261013_0000326');
  });

  it('fetches a USGS detail by event id', async () => {
    const fetchMock = stubSourceResponses(() => Response.json(usgsPanamaDetail));
    const result = await getQueryClient().fetchQuery(earthquakeDetailQueryOptions(USGS_QUAKE));
    expect(result?.source).toBe('usgs');
    expect(result?.detail.earthquake.id).toBe('us6000u18k');
    const url = getRequestedUrl(fetchMock);
    expect(url.hostname).toBe('earthquake.usgs.gov');
    expect(url.searchParams.get('eventid')).toBe('us6000u18k');
  });

  it('resolves null when EMSC answers 204', async () => {
    stubSourceResponses(() => new Response(null, { status: 204 }));
    await expect(
      getQueryClient().fetchQuery(earthquakeDetailQueryOptions(EMSC_QUAKE)),
    ).resolves.toBeNull();
  });

  it('resolves null when USGS answers 404', async () => {
    stubSourceResponses(() => new Response(null, { status: 404 }));
    await expect(
      getQueryClient().fetchQuery(earthquakeDetailQueryOptions(USGS_QUAKE)),
    ).resolves.toBeNull();
  });

  it('resolves null without fetching for an invalid ref', async () => {
    const fetchMock = stubSourceResponses(() => Response.json({}));
    await expect(
      getQueryClient().fetchQuery(earthquakeDetailQueryOptions('isc:123')),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with EarthquakeSourceError on a non-OK response', async () => {
    stubSourceResponses(() => new Response(null, { status: 503 }));
    await expect(
      getQueryClient().fetchQuery(earthquakeDetailQueryOptions(USGS_QUAKE)),
    ).rejects.toBeInstanceOf(EarthquakeSourceError);
  });
});

describe('getDetailEarthquake', () => {
  it('selects the earthquake from a detail', async () => {
    stubSourceResponses(() => Response.json(getEmscDetailFeature()));
    const detail = await getQueryClient().fetchQuery(earthquakeDetailQueryOptions(EMSC_QUAKE));
    expect(getDetailEarthquake(detail)).toBe(detail?.detail.earthquake);
    expect(getDetailEarthquake(detail)?.id).toBe('20261013_0000326');
  });

  it('returns null for a missing detail', () => {
    expect(getDetailEarthquake(null)).toBeNull();
  });
});
