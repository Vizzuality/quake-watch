import { skipToken } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { shakemapContours } from '@/test/fixtures/shakemap-contours';
import { stubFetch } from '@/test/stub-fetch';

import { EarthquakeSourceError } from '../earthquakes/query-options';
import { shakemapContoursQueryOptions } from './query-options';

const URL_CONTOURS = 'https://example.test/cont_mmi.json';

type QueryFn = (ctx: { signal: AbortSignal }) => Promise<unknown>;

function getQueryFn(options: { queryFn?: unknown }): QueryFn {
  return options.queryFn as QueryFn;
}

describe('shakemapContoursQueryOptions', () => {
  it('keys by url and never goes stale', () => {
    const options = shakemapContoursQueryOptions(URL_CONTOURS);
    expect(options.queryKey).toEqual(['shakemap', 'contours', URL_CONTOURS]);
    expect(options.staleTime).toBe(Infinity);
    expect(options.retry).toBe(1);
  });

  it('skips the fetch without a url', () => {
    expect(shakemapContoursQueryOptions(undefined).queryFn).toBe(skipToken);
  });

  it('fetches with the abort signal and parses the contours', async () => {
    const fetchMock = stubFetch([
      { match: () => true, respond: () => Response.json(shakemapContours) },
    ]);
    const controller = new AbortController();
    const contours = await getQueryFn(shakemapContoursQueryOptions(URL_CONTOURS))({
      signal: controller.signal,
    });
    expect(contours).toHaveLength(4);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
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
