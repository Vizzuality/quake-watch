import { vi } from 'vitest';

type FetchRoute = { match: (url: URL) => boolean; respond: () => Response | Promise<Response> };

export function stubFetch(routes: FetchRoute[]) {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async (input) => {
      const url = new URL(String(input));
      const route = routes.find(({ match }) => match(url));
      if (!route) throw new Error(`Unexpected network request: ${url}`);
      return route.respond();
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
