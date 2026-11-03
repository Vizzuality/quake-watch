import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Detail = { id: string } | null;
type Load = () => Promise<Detail>;
type FetchDetail = (id: string, signal: AbortSignal) => Promise<Detail>;

const MINUTE_MS = 60_000;
const TTL_MS = 5 * MINUTE_MS;
const MAX_ENTRIES = 500;

let cacheModule: typeof import('./detail-server-cache');

function getDeferred() {
  let resolve: (value: Detail) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<Detail>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('getCachedDetail', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    cacheModule = await import('./detail-server-cache');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses one upstream response for repeat views within five minutes', async () => {
    const load = vi.fn<Load>(async () => ({ id: 'a' }));
    const first = await cacheModule.getCachedDetail('usgs:a', load);
    vi.advanceTimersByTime(TTL_MS - 1);
    const second = await cacheModule.getCachedDetail('usgs:a', load);
    expect(load).toHaveBeenCalledOnce();
    expect(second).toBe(first);
  });

  it('asks upstream again once five minutes have passed', async () => {
    const load = vi.fn<Load>(async () => ({ id: 'a' }));
    await cacheModule.getCachedDetail('usgs:a', load);
    vi.advanceTimersByTime(TTL_MS);
    await cacheModule.getCachedDetail('usgs:a', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('makes exactly one upstream call for concurrent requests of an uncached event', () => {
    const load = vi.fn<Load>(() => getDeferred().promise);
    const first = cacheModule.getCachedDetail('usgs:a', load);
    const second = cacheModule.getCachedDetail('usgs:a', load);
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledOnce();
  });

  it('keeps a separate entry per key', async () => {
    const load = vi.fn<Load>(async () => ({ id: 'a' }));
    await cacheModule.getCachedDetail('usgs:a', load);
    await cacheModule.getCachedDetail('emsc:a', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures, so two sequential failures make two upstream calls', async () => {
    const load = vi
      .fn<Load>()
      .mockRejectedValueOnce(new Error('timed out'))
      .mockRejectedValueOnce(new Error('upstream 503'))
      .mockResolvedValueOnce({ id: 'a' });
    await expect(cacheModule.getCachedDetail('usgs:a', load)).rejects.toThrow('timed out');
    await expect(cacheModule.getCachedDetail('usgs:a', load)).rejects.toThrow('upstream 503');
    await expect(cacheModule.getCachedDetail('usgs:a', load)).resolves.toEqual({ id: 'a' });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('caches a confirmed not-found', async () => {
    const load = vi.fn<Load>(async () => null);
    await expect(cacheModule.getCachedDetail('usgs:missing', load)).resolves.toBeNull();
    await expect(cacheModule.getCachedDetail('usgs:missing', load)).resolves.toBeNull();
    expect(load).toHaveBeenCalledOnce();
  });

  it('keeps a newer entry when an older request fails late', async () => {
    const stale = getDeferred();
    const load = vi.fn<Load>().mockReturnValueOnce(stale.promise).mockResolvedValue({ id: 'a' });
    const first = cacheModule.getCachedDetail('usgs:a', load);
    vi.advanceTimersByTime(TTL_MS);
    const fresh = await cacheModule.getCachedDetail('usgs:a', load);
    stale.reject(new Error('timed out'));
    await expect(first).rejects.toThrow('timed out');
    await expect(cacheModule.getCachedDetail('usgs:a', load)).resolves.toBe(fresh);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest entry beyond the size bound', async () => {
    const load = vi.fn<Load>(async () => ({ id: 'x' }));
    for (let index = 0; index <= MAX_ENTRIES; index++) {
      await cacheModule.getCachedDetail(`usgs:${index}`, load);
    }
    expect(load).toHaveBeenCalledTimes(MAX_ENTRIES + 1);
    await cacheModule.getCachedDetail(`usgs:${MAX_ENTRIES}`, load);
    await cacheModule.getCachedDetail('usgs:1', load);
    expect(load).toHaveBeenCalledTimes(MAX_ENTRIES + 1);
    await cacheModule.getCachedDetail('usgs:0', load);
    expect(load).toHaveBeenCalledTimes(MAX_ENTRIES + 2);
  });

  it('keeps a recently read entry over an older unread one', async () => {
    const load = vi.fn<Load>(async () => ({ id: 'x' }));
    for (let index = 0; index < MAX_ENTRIES; index++) {
      await cacheModule.getCachedDetail(`usgs:${index}`, load);
    }
    await cacheModule.getCachedDetail('usgs:0', load);
    await cacheModule.getCachedDetail('usgs:new', load);
    await cacheModule.getCachedDetail('usgs:0', load);
    expect(load).toHaveBeenCalledTimes(MAX_ENTRIES + 1);
    await cacheModule.getCachedDetail('usgs:1', load);
    expect(load).toHaveBeenCalledTimes(MAX_ENTRIES + 2);
  });

  it('still settles for callers awaiting an in-flight entry that gets evicted', async () => {
    const pending = getDeferred();
    const first = cacheModule.getCachedDetail('usgs:slow', () => pending.promise);
    const load = vi.fn<Load>(async () => ({ id: 'x' }));
    for (let index = 0; index < MAX_ENTRIES; index++) {
      await cacheModule.getCachedDetail(`usgs:${index}`, load);
    }
    pending.resolve({ id: 'slow' });
    await expect(first).resolves.toEqual({ id: 'slow' });
  });
});

describe('getServerDetail', () => {
  beforeEach(async () => {
    vi.resetModules();
    cacheModule = await import('./detail-server-cache');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches once per source and id with its own four second timeout', async () => {
    const deadline = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline);
    const fetchDetail = vi.fn<FetchDetail>(async (id) => ({ id }));
    await cacheModule.getServerDetail('usgs', 'a', fetchDetail);
    await cacheModule.getServerDetail('usgs', 'a', fetchDetail);
    await cacheModule.getServerDetail('emsc', 'a', fetchDetail);
    expect(fetchDetail).toHaveBeenCalledTimes(2);
    expect(fetchDetail).toHaveBeenCalledWith('a', deadline);
    expect(timeout).toHaveBeenCalledWith(4_000);
  });

  it('releases an aborted caller without aborting the shared fetch', async () => {
    const pending = getDeferred();
    const fetchDetail = vi.fn<FetchDetail>(() => pending.promise);
    const caller = new AbortController();
    const first = cacheModule.getServerDetail('usgs', 'a', fetchDetail, caller.signal);
    const second = cacheModule.getServerDetail('usgs', 'a', fetchDetail);
    caller.abort(new DOMException('navigated away', 'AbortError'));
    await expect(first).rejects.toThrow('navigated away');
    pending.resolve({ id: 'a' });
    await expect(second).resolves.toEqual({ id: 'a' });
    expect(fetchDetail.mock.calls[0]?.[1]).not.toBe(caller.signal);
    expect(fetchDetail).toHaveBeenCalledOnce();
  });

  it('rejects at once for a caller that has already aborted', async () => {
    const fetchDetail = vi.fn<FetchDetail>(async (id) => ({ id }));
    const caller = new AbortController();
    caller.abort(new DOMException('gone', 'AbortError'));
    await expect(
      cacheModule.getServerDetail('usgs', 'a', fetchDetail, caller.signal),
    ).rejects.toThrow('gone');
  });
});
