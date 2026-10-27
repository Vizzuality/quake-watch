import { afterEach, describe, expect, it, vi } from 'vitest';

import { usgsOriginOnlyDetail, usgsPanamaDetail } from '@/test/fixtures/usgs-detail';
import { stubFetch, stubHangingFetch } from '@/test/stub-fetch';

import { EarthquakeSourceError } from '../query-options';
import { getUsgsEarthquakeDetail, getUsgsEarthquakeDetailFromFeature } from './usgs';
import { usgsEarthquakeDetailQueryOptions } from './usgs-query-options';

const runtime = vi.hoisted(() => ({ isServer: false }));

vi.mock('@/paraglide/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/paraglide/runtime')>()),
  get isServer() {
    return runtime.isServer;
  },
}));

function getFeatureWith(products: Record<string, unknown>, tsunami = 0) {
  return {
    ...usgsOriginOnlyDetail,
    properties: { ...usgsOriginOnlyDetail.properties, tsunami, products },
  };
}

const planes = {
  'nodal-plane-1-strike': '10',
  'nodal-plane-1-dip': '20',
  'nodal-plane-1-rake': '30',
  'nodal-plane-2-strike': '40',
  'nodal-plane-2-dip': '50',
  'nodal-plane-2-rake': '60',
};

describe('getUsgsEarthquakeDetailFromFeature', () => {
  it('maps the header Earthquake and every section for the M7.7 Panama event', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(usgsPanamaDetail);
    expect(detail?.earthquake).toMatchObject({
      id: 'us6000u18k',
      source: 'usgs',
      magnitude: 7.7,
      magnitudeType: 'mww',
      place: '12 km WSW of Pitaloza Arriba, Panama',
      time: 1791568566036,
      depthKm: 12.647,
      longitude: -80.769,
      latitude: 7.5868,
    });
    expect(detail).toMatchObject({ status: 'reviewed', significance: 1790 });
    expect(detail?.origin).toEqual({
      depthType: 'from location',
      horizontalErrorKm: 6.48,
      verticalErrorKm: 3.947,
      azimuthalGapDeg: 45,
      numStationsUsed: 108,
      numPhasesUsed: 108,
      standardErrorS: 0.84,
      minimumDistanceDeg: 1.82,
      reviewStatus: 'reviewed',
      network: 'us',
    });
    expect(detail?.impact).toEqual({
      pagerAlert: 'orange',
      shakemapMaxMmi: 7.707,
      dyfiResponses: 1805,
      dyfiMaxMmi: 7.9,
      tsunami: false,
    });
  });

  it('picks the preferred moment tensor when there are two', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(usgsPanamaDetail);
    expect(detail?.mechanism?.derivedDepthKm).toBe(13.5);
    expect(detail?.mechanism?.nodalPlanes[0].strikeDeg).toBe(25.21);
  });

  it('picks the highest preferredWeight regardless of array order', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(
      getFeatureWith({
        'moment-tensor': [
          { preferredWeight: 1, properties: { ...planes, 'derived-depth': '1' } },
          { preferredWeight: 9, properties: { ...planes, 'derived-depth': '9' } },
          { properties: { ...planes, 'derived-depth': '5' } },
        ],
      }),
    );
    expect(detail?.mechanism?.derivedDepthKm).toBe(9);
  });

  it('maps the preferred ShakeMap contour URL', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(usgsPanamaDetail);
    expect(detail?.shakemap).toEqual({
      contoursUrl:
        'https://earthquake.usgs.gov/product/shakemap/us6000u18k/us/1791835000028/download/cont_mmi.json',
    });
  });

  it('returns a null shakemap when the product lacks the contours', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(
      getFeatureWith({
        shakemap: [
          {
            preferredWeight: 1,
            properties: { maxmmi: '5' },
            contents: {
              'download/coverage_mmi_medium_res.covjson': { url: 'https://example.test/cov.json' },
            },
          },
        ],
      }),
    );
    expect(detail?.shakemap).toBeNull();
    expect(detail?.impact?.shakemapMaxMmi).toBe(5);
  });

  it('accepts inline contents without a url, as general-text products ship them', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(
      getFeatureWith({
        'general-text': [
          { preferredWeight: 1, properties: {}, contents: { '': { bytes: '<p>Note</p>' } } },
        ],
      }),
    );
    expect(detail).not.toBeNull();
    expect(detail?.shakemap).toBeNull();
  });

  it('keeps the shakemap files when a sibling content entry has an odd shape', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(
      getFeatureWith({
        shakemap: [
          {
            preferredWeight: 1,
            properties: {},
            contents: {
              'download/cont_mmi.json': { url: 'https://example.test/cont.json' },
              'download/coverage_mmi_medium_res.covjson': { url: 'https://example.test/cov.json' },
              'download/odd.bin': 'not-an-object',
              'download/odd-url.txt': { url: 42 },
            },
          },
        ],
      }),
    );
    expect(detail?.shakemap).toEqual({ contoursUrl: 'https://example.test/cont.json' });
  });

  it('ignores contents of an unexpected shape, as event-sequence products ship them', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(
      getFeatureWith({ 'event-sequence': [{ preferredWeight: 1, properties: {}, contents: [] }] }),
    );
    expect(detail).not.toBeNull();
  });

  it('returns a null shakemap when the product has no contents', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(
      getFeatureWith({ shakemap: [{ preferredWeight: 1, properties: { maxmmi: '5' } }] }),
    );
    expect(detail?.shakemap).toBeNull();
  });

  it('reads the shakemap files from the highest preferredWeight product', () => {
    const files = (name: string) => ({
      'download/cont_mmi.json': { url: `https://example.test/${name}/cont.json` },
      'download/coverage_mmi_medium_res.covjson': { url: `https://example.test/${name}/cov.json` },
    });
    const detail = getUsgsEarthquakeDetailFromFeature(
      getFeatureWith({
        shakemap: [
          { preferredWeight: 9, properties: {}, contents: files('best') },
          { preferredWeight: 1, properties: {}, contents: files('other') },
        ],
      }),
    );
    expect(detail?.shakemap?.contoursUrl).toBe('https://example.test/best/cont.json');
  });

  it('returns null sections for an origin-only Earthquake', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(usgsOriginOnlyDetail);
    expect(detail?.shakemap).toBeNull();
    expect(detail?.origin?.numStationsUsed).toBe(54);
    expect(detail?.impact).toBeNull();
    expect(detail?.mechanism).toBeNull();
  });

  it('returns null origin and nulls for a feature without products', () => {
    const feature = {
      ...usgsOriginOnlyDetail,
      properties: { ...usgsOriginOnlyDetail.properties, products: undefined, sig: undefined },
    };
    const detail = getUsgsEarthquakeDetailFromFeature(feature);
    expect(detail).toMatchObject({ origin: null, impact: null, mechanism: null });
    expect(detail?.significance).toBeNull();
  });

  it('returns null mechanism without throwing when nodal-plane-2 values are missing', () => {
    const { 'nodal-plane-2-strike': _s, 'nodal-plane-2-dip': _d, ...partial } = planes;
    const detail = getUsgsEarthquakeDetailFromFeature(
      getFeatureWith({ 'moment-tensor': [{ preferredWeight: 1, properties: partial }] }),
    );
    expect(detail?.mechanism).toBeNull();
  });

  it('returns null mechanism for non-numeric or blank nodal values', () => {
    const bad = (value: unknown) =>
      getUsgsEarthquakeDetailFromFeature(
        getFeatureWith({
          'moment-tensor': [
            { preferredWeight: 1, properties: { ...planes, 'nodal-plane-1-rake': value } },
          ],
        }),
      )?.mechanism;
    expect(bad('abc')).toBeNull();
    expect(bad(' ')).toBeNull();
    expect(bad(null)).toBeNull();
    expect(bad(30)).not.toBeNull();
  });

  it('returns null origin fields for blank or non-numeric values', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(
      getFeatureWith({
        origin: [
          {
            preferredWeight: 1,
            properties: { 'horizontal-error': '-', 'num-stations-used': '' },
          },
        ],
      }),
    );
    expect(detail?.origin).toMatchObject({ horizontalErrorKm: null, numStationsUsed: null });
  });

  it('keeps impact when only tsunami is flagged', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(getFeatureWith({}, 1));
    expect(detail?.impact).toEqual({
      pagerAlert: null,
      shakemapMaxMmi: null,
      dyfiResponses: null,
      dyfiMaxMmi: null,
      tsunami: true,
    });
  });

  it('ignores unknown pager levels and missing optional strings', () => {
    const detail = getUsgsEarthquakeDetailFromFeature(
      getFeatureWith({ losspager: [{ preferredWeight: 1, properties: { alertlevel: 'purple' } }] }),
    );
    expect(detail?.impact?.pagerAlert).toBeNull();
    expect(detail?.origin).toBeNull();
  });

  it('returns null for invalid features', () => {
    expect(getUsgsEarthquakeDetailFromFeature(null)).toBeNull();
    expect(getUsgsEarthquakeDetailFromFeature({ id: 'x' })).toBeNull();
  });
});

describe('getUsgsEarthquakeDetail', () => {
  it('requests the event by id and parses it', async () => {
    const fetchMock = stubFetch([
      {
        match: (url) => url.searchParams.get('eventid') === 'us6000u18k',
        respond: () => Response.json(usgsPanamaDetail),
      },
    ]);
    const detail = await getUsgsEarthquakeDetail('us6000u18k');
    expect(detail?.earthquake.id).toBe('us6000u18k');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('format=geojson');
  });

  it('returns null for an unknown id (404)', async () => {
    stubFetch([{ match: () => true, respond: () => new Response('Not Found', { status: 404 }) }]);
    await expect(getUsgsEarthquakeDetail('nope')).resolves.toBeNull();
  });

  it('returns null for a deleted event (409)', async () => {
    stubFetch([{ match: () => true, respond: () => new Response(null, { status: 409 }) }]);
    await expect(getUsgsEarthquakeDetail('us6000gone')).resolves.toBeNull();
  });

  it.each([400, 413])('throws EarthquakeSourceError when USGS answers %i', async (status) => {
    stubFetch([{ match: () => true, respond: () => new Response(null, { status }) }]);
    await expect(getUsgsEarthquakeDetail('us6000u4zb')).rejects.toBeInstanceOf(
      EarthquakeSourceError,
    );
  });

  it.each(['<script>', 'US6000U4ZB', 'u', 'a'.repeat(41), '../query', 'us6000 u4zb'])(
    'never asks USGS about the malformed id %j',
    async (id) => {
      const fetchMock = stubFetch([]);
      await expect(getUsgsEarthquakeDetail(id)).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(['us6000u4zb', 'ak0251bz7wov', 'aka2026vfmqfn', 'official20110311054624120_30'])(
    'asks USGS about the well-formed id %s',
    async (id) => {
      const fetchMock = stubFetch([
        { match: () => true, respond: () => new Response(null, { status: 404 }) },
      ]);
      await getUsgsEarthquakeDetail(id);
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it('throws EarthquakeSourceError on a 200 with an invalid feature', async () => {
    stubFetch([{ match: () => true, respond: () => Response.json({ id: 'x' }) }]);
    await expect(getUsgsEarthquakeDetail('us6000xxxx')).rejects.toBeInstanceOf(
      EarthquakeSourceError,
    );
  });

  it('throws EarthquakeSourceError on a 500', async () => {
    stubFetch([{ match: () => true, respond: () => new Response('boom', { status: 500 }) }]);
    const error = await getUsgsEarthquakeDetail('us6000u18k').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EarthquakeSourceError);
    expect(error).toMatchObject({ source: 'usgs', status: 500 });
  });
});

describe('usgsEarthquakeDetailQueryOptions', () => {
  it('keys by source and id with a five minute stale time', () => {
    const options = usgsEarthquakeDetailQueryOptions('us6000u18k');
    expect(options.queryKey).toEqual(['earthquake-detail', 'usgs', 'us6000u18k']);
    expect(options.staleTime).toBe(300_000);
  });

  it('fetches through the queryFn', async () => {
    stubFetch([{ match: () => true, respond: () => Response.json(usgsPanamaDetail) }]);
    const options = usgsEarthquakeDetailQueryOptions('us6000u18k');
    const queryFn = options.queryFn as (ctx: { signal: AbortSignal }) => Promise<unknown>;
    const detail = await queryFn({ signal: new AbortController().signal });
    expect(detail).toMatchObject({ earthquake: { id: 'us6000u18k' } });
  });
});

describe('usgsEarthquakeDetailQueryOptions on each runtime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function getQueryFn(isServer: boolean) {
    runtime.isServer = isServer;
    const options = usgsEarthquakeDetailQueryOptions('us6000u18k');
    return {
      retry: options.retry,
      queryFn: options.queryFn as (ctx: { signal: AbortSignal }) => Promise<unknown>,
    };
  }

  it('retries once and passes the caller signal through in the browser', async () => {
    const fetchMock = stubFetch([
      { match: () => true, respond: () => Response.json(usgsPanamaDetail) },
    ]);
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { retry, queryFn } = getQueryFn(false);
    const signal = new AbortController().signal;
    await queryFn({ signal });
    expect(retry).toBe(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(signal);
    expect(timeout).not.toHaveBeenCalled();
  });

  it('gives up after 4 s on the server and does not retry', async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    stubHangingFetch();
    const { retry, queryFn } = getQueryFn(true);
    const pending = queryFn({ signal: new AbortController().signal });
    deadline.abort(new DOMException('USGS took too long', 'TimeoutError'));
    await expect(pending).rejects.toThrow('USGS took too long');
    expect(timeout).toHaveBeenCalledWith(4_000);
    expect(retry).toBe(0);
  });

  it('still stops on the server when the caller aborts first', async () => {
    stubHangingFetch();
    const caller = new AbortController();
    const pending = getQueryFn(true).queryFn({ signal: caller.signal });
    caller.abort(new DOMException('navigated away', 'AbortError'));
    await expect(pending).rejects.toThrow('navigated away');
  });
});
