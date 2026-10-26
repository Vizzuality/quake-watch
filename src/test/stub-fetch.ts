import { vi } from 'vitest';

type FetchRoute = { match: (url: URL) => boolean; respond: () => Response | Promise<Response> };

export function stubFetch(routes: FetchRoute[]) {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const route = routes.find(({ match }) => match(url));
      if (!route) throw new Error(`Unexpected network request: ${url}`);
      return route.respond();
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function stubHangingFetch() {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        signal?.addEventListener('abort', () => reject(signal.reason));
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
