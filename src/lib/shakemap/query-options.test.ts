import { describe, expect, it } from 'vitest';

import { shakemapContours } from '@/test/fixtures/shakemap-contours';
import { shakemapCoverage } from '@/test/fixtures/shakemap-coverage';
import { stubFetch } from '@/test/stub-fetch';

import { EarthquakeSourceError } from '../earthquakes/query-options';
import { shakemapContoursQueryOptions, shakemapCoverageQueryOptions } from './query-options';

const URL_COVERAGE = 'https://example.test/coverage.covjson';
const URL_CONTOURS = 'https://example.test/cont_mmi.json';

type QueryFn = (ctx: { signal: AbortSignal }) => Promise<unknown>;

function getQueryFn(options: { queryFn?: unknown }): QueryFn {
  return options.queryFn as QueryFn;
}

describe('shakemapCoverageQueryOptions', () => {
  it('keys by url and never goes stale', () => {
    const options = shakemapCoverageQueryOptions(URL_COVERAGE);
    expect(options.queryKey).toEqual(['shakemap', 'coverage', URL_COVERAGE]);
    expect(options.staleTime).toBe(Infinity);
    expect(options.retry).toBe(1);
  });

  it('fetches with the abort signal and parses the grid', async () => {
    const fetchMock = stubFetch([
      {
        match: (url) => String(url) === URL_COVERAGE,
        respond: () => Response.json(shakemapCoverage),
      },
    ]);
    const controller = new AbortController();
    const grid = await getQueryFn(shakemapCoverageQueryOptions(URL_COVERAGE))({
      signal: controller.signal,
    });
    expect(grid).toMatchObject({ columns: 5, rows: 4 });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
  });

  it('throws EarthquakeSourceError on a non-ok response', async () => {
    stubFetch([{ match: () => true, respond: () => new Response('boom', { status: 503 }) }]);
    const error = await getQueryFn(shakemapCoverageQueryOptions(URL_COVERAGE))({
      signal: new AbortController().signal,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EarthquakeSourceError);
    expect(error).toMatchObject({ source: 'usgs', status: 503 });
  });

  it('throws EarthquakeSourceError on a malformed body', async () => {
    stubFetch([{ match: () => true, respond: () => Response.json({ nope: true }) }]);
    await expect(
      getQueryFn(shakemapCoverageQueryOptions(URL_COVERAGE))({
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(EarthquakeSourceError);
  });
});

describe('shakemapContoursQueryOptions', () => {
  it('keys by url and never goes stale', () => {
    const options = shakemapContoursQueryOptions(URL_CONTOURS);
    expect(options.queryKey).toEqual(['shakemap', 'contours', URL_CONTOURS]);
    expect(options.staleTime).toBe(Infinity);
    expect(options.retry).toBe(1);
  });

  it('fetches and parses the contours', async () => {
    stubFetch([{ match: () => true, respond: () => Response.json(shakemapContours) }]);
    const contours = await getQueryFn(shakemapContoursQueryOptions(URL_CONTOURS))({
      signal: new AbortController().signal,
    });
    expect(contours).toHaveLength(4);
  });

  it('throws EarthquakeSourceError on a non-ok response', async () => {
    stubFetch([{ match: () => true, respond: () => new Response('gone', { status: 404 }) }]);
    await expect(
      getQueryFn(shakemapContoursQueryOptions(URL_CONTOURS))({
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(EarthquakeSourceError);
  });
});
