import { afterEach, describe, expect, it, vi } from 'vitest';

import { getEmscDetailFeature } from '@/test/fixtures/emsc-detail';
import { stubFetch } from '@/test/stub-fetch';

import { EarthquakeSourceError } from '../query-options';
import { getEmscEarthquakeDetail, getEmscEarthquakeDetailFromFeature } from './emsc';

function stubResponse(respond: () => Response) {
  return stubFetch([{ match: (url) => url.hostname === 'www.seismicportal.eu', respond }]);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getEmscEarthquakeDetailFromFeature', () => {
  it('maps author, catalog, Flynn region and last update', () => {
    const detail = getEmscEarthquakeDetailFromFeature(getEmscDetailFeature());
    expect(detail).toMatchObject({
      author: 'NEIC',
      sourceCatalog: 'EMSC-RTS',
      flynnRegion: 'NEW BRITAIN REGION, P.N.G.',
      lastUpdate: Date.parse('2026-10-13T16:58:41.956Z'),
    });
    expect(detail?.earthquake).toMatchObject({
      id: '20261013_0000326',
      source: 'emsc',
      magnitude: 5.1,
      depthKm: 28.4,
      longitude: 152.1142,
      latitude: -5.4162,
      url: 'https://www.seismicportal.eu/eventdetails.html?unid=20261013_0000326',
    });
  });

  it('passes depth 0 and negative depth through as given', () => {
    expect(
      getEmscEarthquakeDetailFromFeature(getEmscDetailFeature({ depth: 0 }))?.earthquake.depthKm,
    ).toBe(0);
    expect(
      getEmscEarthquakeDetailFromFeature(getEmscDetailFeature({ depth: -1 }))?.earthquake.depthKm,
    ).toBe(-1);
  });

  it('nulls missing optional fields and unparsable last update', () => {
    const feature = getEmscDetailFeature({ lastupdate: 'nope' });
    const { auth, source_catalog, flynn_region, ...rest } = feature.properties;
    const detail = getEmscEarthquakeDetailFromFeature({ ...feature, properties: rest });
    expect(auth).toBe('NEIC');
    expect(source_catalog).toBe('EMSC-RTS');
    expect(flynn_region).toBeTruthy();
    expect(detail).toMatchObject({
      author: null,
      sourceCatalog: null,
      flynnRegion: null,
      lastUpdate: null,
    });
    expect(
      getEmscEarthquakeDetailFromFeature(getEmscDetailFeature({ lastupdate: null }))?.lastUpdate,
    ).toBeNull();
  });

  it('returns null for an invalid feature', () => {
    expect(getEmscEarthquakeDetailFromFeature({ type: 'Feature' })).toBeNull();
    expect(getEmscEarthquakeDetailFromFeature(null)).toBeNull();
  });
});

describe('getEmscEarthquakeDetail', () => {
  it('requests the URL-encoded event id and forwards the signal', async () => {
    const fetchMock = stubResponse(() => Response.json(getEmscDetailFeature()));
    const controller = new AbortController();
    const detail = await getEmscEarthquakeDetail('20261013_0000326', controller.signal);
    const [input, init] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(url.searchParams.get('eventid')).toBe('20261013_0000326');
    expect(url.searchParams.get('format')).toBe('json');
    expect(init?.signal).toBe(controller.signal);
    expect(detail?.earthquake.id).toBe('20261013_0000326');
  });

  it.each(['a b&c', '<script>', 'doesnotexist123', '2026102_0000164', '20261026_000016', ''])(
    'never asks EMSC about the malformed id %j',
    async (id) => {
      const fetchMock = stubResponse(() => new Response(null, { status: 204 }));
      expect(await getEmscEarthquakeDetail(id)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('returns null for an unknown id (HTTP 204)', async () => {
    stubResponse(() => new Response(null, { status: 204 }));
    expect(await getEmscEarthquakeDetail('20261013_9999999')).toBeNull();
  });

  it.each([400, 409, 413])('throws EarthquakeSourceError when EMSC answers %i', async (status) => {
    stubResponse(() => new Response(null, { status }));
    await expect(getEmscEarthquakeDetail('20261013_0000326')).rejects.toBeInstanceOf(
      EarthquakeSourceError,
    );
  });

  it('throws EarthquakeSourceError when a 200 body fails the schema', async () => {
    stubResponse(() => Response.json({}));
    await expect(getEmscEarthquakeDetail('20261013_0000326')).rejects.toBeInstanceOf(
      EarthquakeSourceError,
    );
  });

  it('throws EarthquakeSourceError on other failures', async () => {
    stubResponse(() => new Response('boom', { status: 503 }));
    await expect(getEmscEarthquakeDetail('20261013_0000326')).rejects.toMatchObject({
      name: 'EarthquakeSourceError',
      source: 'emsc',
      status: 503,
    });
    await expect(getEmscEarthquakeDetail('20261013_0000326')).rejects.toBeInstanceOf(
      EarthquakeSourceError,
    );
  });
});
