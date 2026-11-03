import { SERVER_FETCH_TIMEOUT_MS } from './detail-fetch-policy';

export const DETAIL_SERVER_CACHE_TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 500;

type CacheEntry = { promise: Promise<unknown>; expiresAt: number };

const cache = new Map<string, CacheEntry>();

export function getCachedDetail<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);
  cache.delete(key);
  if (cached && cached.expiresAt > now) {
    cache.set(key, cached);
    return cached.promise as Promise<T>;
  }

  const promise = load();
  cache.set(key, { promise, expiresAt: now + DETAIL_SERVER_CACHE_TTL_MS });
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  for (const oldest of cache.keys()) {
    if (cache.size <= MAX_ENTRIES) break;
    cache.delete(oldest);
  }
  return promise;
}

function getCallerBound<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export function getServerDetail<T>(
  source: string,
  id: string,
  fetchDetail: (id: string, signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const shared = getCachedDetail(`${source}:${id}`, () =>
    fetchDetail(id, AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS)),
  );
  return getCallerBound(shared, signal);
}
