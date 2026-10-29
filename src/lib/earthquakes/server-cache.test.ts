import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EarthquakesResult } from './query-options';
import { earthquakeSearchSchema } from './search-schema';
import type { EarthquakeSearch } from './search-schema';

type Load = (search: EarthquakeSearch) => Promise<EarthquakesResult>;

const MINUTE_MS = 60_000;

let getCachedEarthquakes: typeof import('./server-cache').getCachedEarthquakes;

function getSearch(input: Record<string, unknown> = {}) {
  return earthquakeSearchSchema.parse(input);
}

function getResult(): EarthquakesResult {
  return { earthquakes: [], isTruncated: false, fetchedAt: Date.now() };
}

function getDeferred() {
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<EarthquakesResult>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

describe('getCachedEarthquakes', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ getCachedEarthquakes } = await import('./server-cache'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads once for two requests within a minute', async () => {
    const load = vi.fn<Load>(async () => getResult());
    const first = await getCachedEarthquakes(getSearch(), load);
    vi.advanceTimersByTime(MINUTE_MS - 1);
    const second = await getCachedEarthquakes(getSearch({ sort: 'magnitude.desc' }), load);
    expect(load).toHaveBeenCalledOnce();
    expect(second).toBe(first);
  });

  it('loads again once the minute is over', async () => {
    const load = vi.fn<Load>(async () => getResult());
    await getCachedEarthquakes(getSearch(), load);
    vi.advanceTimersByTime(MINUTE_MS);
    await getCachedEarthquakes(getSearch(), load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight request between concurrent callers', () => {
    const load = vi.fn<Load>(() => getDeferred().promise);
    const first = getCachedEarthquakes(getSearch(), load);
    const second = getCachedEarthquakes(getSearch(), load);
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledOnce();
  });

  it('keeps a separate entry per filter set', async () => {
    const load = vi.fn<Load>(async () => getResult());
    await getCachedEarthquakes(getSearch(), load);
    await getCachedEarthquakes(getSearch({ minmag: 4 }), load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('retries on the next request after a failure', async () => {
    const load = vi
      .fn<Load>()
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce(getResult());
    await expect(getCachedEarthquakes(getSearch(), load)).rejects.toThrow('upstream down');
    await expect(getCachedEarthquakes(getSearch(), load)).resolves.toMatchObject({
      earthquakes: [],
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps a newer entry when an older request fails late', async () => {
    const stale = getDeferred();
    const fresh = getResult();
    const load = vi.fn<Load>().mockReturnValueOnce(stale.promise).mockResolvedValue(fresh);
    const first = getCachedEarthquakes(getSearch(), load);
    vi.advanceTimersByTime(MINUTE_MS);
    await getCachedEarthquakes(getSearch(), load);
    stale.reject(new Error('timed out'));
    await expect(first).rejects.toThrow('timed out');
    await expect(getCachedEarthquakes(getSearch(), load)).resolves.toBe(fresh);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
