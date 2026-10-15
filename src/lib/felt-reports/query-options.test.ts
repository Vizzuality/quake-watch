import { describe, expect, it } from 'vitest';

import { EarthquakeSourceError } from '@/lib/earthquakes/query-options';
import {
  getFeltReportsCsv as getCsv,
  getFeltReportsZip as getZip,
} from '@/test/fixtures/felt-reports-zip';
import { stubFetch } from '@/test/stub-fetch';

import { feltReportsQueryOptions } from './query-options';

const UNID = '20261009_0000264';
type QueryFn = (ctx: { signal: AbortSignal }) => Promise<unknown>;

function getQueryFn(options: { queryFn?: unknown }): QueryFn {
  return options.queryFn as QueryFn;
}

function run(unid = UNID) {
  return getQueryFn(feltReportsQueryOptions(unid))({ signal: new AbortController().signal });
}

async function stubZip(files: Record<string, string>) {
  const body = await getZip(files);
  return stubFetch([{ match: () => true, respond: () => new Response(body) }]);
}

describe('feltReportsQueryOptions', () => {
  it('keys by unid and never goes stale', () => {
    const options = feltReportsQueryOptions(UNID);
    expect(options.queryKey).toEqual(['felt-reports', UNID]);
    expect(options.staleTime).toBe(Infinity);
    expect(options.retry).toBe(1);
  });

  it('requests the EMSC testimonies search with the encoded unid', async () => {
    const fetchMock = await stubZip({ [`${UNID}.csv`]: getCsv([]) });
    const controller = new AbortController();
    await getQueryFn(feltReportsQueryOptions('a b'))({ signal: controller.signal });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://www.seismicportal.eu/testimonies-ws/api/search?eventid=a%20b&includeTestimonies=true',
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
  });

  it('returns no cells on 204', async () => {
    stubFetch([{ match: () => true, respond: () => new Response(null, { status: 204 }) }]);
    expect(await run()).toEqual([]);
  });

  it('throws EarthquakeSourceError on a non-ok response', async () => {
    stubFetch([{ match: () => true, respond: () => new Response('boom', { status: 503 }) }]);
    const error = await run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EarthquakeSourceError);
    expect(error).toMatchObject({ source: 'emsc', status: 503 });
  });

  it('picks the unid csv among extra files and returns averaged cells', async () => {
    await stubZip({
      'events.csv': getCsv(['0,0,t,app,9,9']),
      'LICENCE.txt': 'CC BY 4.0',
      [`${UNID}.csv`]: getCsv(['-3.7,40.4,t,app,2,2', '-3.7,40.4,t,app,3,3', '1,1,t,app,12,12']),
    });
    expect(await run()).toEqual([expect.objectContaining({ count: 2, mmi: expect.closeTo(2.5) })]);
  });

  it('falls back to the single csv that is not events.csv', async () => {
    await stubZip({ 'events.csv': getCsv([]), 'other.csv': getCsv(['0,0,t,app,4,4']) });
    expect(await run()).toHaveLength(1);
  });

  it('throws when no usable csv is in the archive', async () => {
    await stubZip({ 'events.csv': getCsv([]), 'a.csv': getCsv([]), 'b.csv': getCsv([]) });
    await expect(run()).rejects.toMatchObject({ source: 'emsc', status: 200 });
    await stubZip({ 'events.csv': getCsv([]) });
    await expect(run()).rejects.toBeInstanceOf(EarthquakeSourceError);
  });

  it('throws EarthquakeSourceError when the body is not a ZIP', async () => {
    stubFetch([{ match: () => true, respond: () => new Response('<html>') }]);
    await expect(run()).rejects.toMatchObject({ source: 'emsc', status: 200 });
  });
});
