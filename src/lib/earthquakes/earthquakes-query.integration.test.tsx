import { QueryClient, QueryClientProvider, focusManager, useQuery } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { createRef, useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { CAMERA_DEBOUNCE_MS, type Camera, useCameraSearch } from '@/hooks/use-camera-search';
import { type FilterSearchPatch, useFilterSearch } from '@/hooks/use-filter-search';
import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { EARTHQUAKE_SEARCH_ROUTE, getEarthquakeFilters } from '@/lib/earthquakes/search-schema';
import { Route } from '@/routes/index';
import { getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

type Setters = {
  setCamera: (camera: Camera) => void;
  setSearch: (patch: FilterSearchPatch) => Promise<void>;
};

const LIST_PATH = '/fdsnws/event/1/query';

function isListRequest(url: URL) {
  return url.pathname === LIST_PATH;
}

function getRequestUrl(input: RequestInfo | URL) {
  return new URL(input instanceof Request ? input.url : String(input));
}

function settle(ms = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const unmounts: (() => void)[] = [];

async function renderEarthquakesQuery(initialEntry = '/') {
  const fetchMock = stubFetch([
    { match: isListRequest, respond: () => Response.json(getFeatureCollection([])) },
  ]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const settersRef = createRef<Setters>();

  function Probe() {
    const search = indexRoute.useSearch();
    useQuery(earthquakesQueryOptions(getEarthquakeFilters(search)));
    const setCamera = useCameraSearch();
    const setSearch = useFilterSearch();
    useImperativeHandle(settersRef, () => ({ setCamera, setSearch }), [setCamera, setSearch]);
    return null;
  }

  const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: Outlet,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    loaderDeps: Route.options.loaderDeps,
    loader: Route.options.loader,
    component: Probe,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    context: { queryClient },
  });
  await router.load();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  unmounts.push(() => {
    screen.unmount();
    queryClient.clear();
  });
  if (!settersRef.current) throw new Error('earthquakes query probe did not mount');

  function getListUrls() {
    return fetchMock.mock.calls.map(([input]) => getRequestUrl(input)).filter(isListRequest);
  }

  return { router, setters: settersRef.current, getListUrls };
}

describe('earthquakes query', () => {
  beforeEach(() => {
    focusManager.setFocused(true);
  });

  afterEach(() => {
    unmounts.splice(0).forEach((unmount) => unmount());
    vi.useRealTimers();
    focusManager.setFocused(undefined);
  });

  it('shares one list request between the loader and the observer, untouched by camera, place and quake', async () => {
    const { router, setters, getListUrls } = await renderEarthquakesQuery();
    await expect.poll(() => getListUrls().length).toBe(1);

    setters.setCamera({ lat: 37.18, lon: -3.6, zoom: 4 });
    await settle(CAMERA_DEBOUNCE_MS + 50);
    await expect
      .poll(() => router.state.location.search)
      .toMatchObject({ lat: 37.18, lon: -3.6, zoom: 4 });

    await setters.setSearch({ place: 'Spain' });
    expect(router.state.location.search).toMatchObject({ place: 'Spain' });
    await setters.setSearch({ quake: 'usgs:us7000abcd' });
    expect(router.state.location.search).toMatchObject({ quake: 'usgs:us7000abcd' });

    await settle();
    expect(getListUrls()).toHaveLength(1);
  });

  it('fetches again once when a filter changes', async () => {
    const { setters, getListUrls } = await renderEarthquakesQuery();
    await expect.poll(() => getListUrls().length).toBe(1);

    await setters.setSearch({ minmag: 5 });
    await expect.poll(() => getListUrls().length).toBe(2);
    await settle();

    const urls = getListUrls();
    expect(urls).toHaveLength(2);
    expect(urls[1]?.searchParams.get('minmagnitude')).toBe('5');
  });

  it('skips the list prefetch on a hover preload', async () => {
    const { router, getListUrls } = await renderEarthquakesQuery();
    await expect.poll(() => getListUrls().length).toBe(1);

    await router.preloadRoute({ to: '/', search: { minmag: 6 } });
    await settle();
    expect(getListUrls()).toHaveLength(1);
  });

  it('polls every 60 s while the interval is 24h', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { getListUrls } = await renderEarthquakesQuery('/?interval=24h');
    await expect.poll(() => getListUrls().length).toBe(1);

    for (const expected of [2, 3, 4]) {
      await vi.advanceTimersByTimeAsync(60_000);
      await expect.poll(() => getListUrls().length).toBe(expected);
    }
  });

  it.each(['/?interval=3d', '/'])('does not poll for %s', async (initialEntry) => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { getListUrls } = await renderEarthquakesQuery(initialEntry);
    await expect.poll(() => getListUrls().length).toBe(1);

    for (let step = 0; step < 3; step += 1) {
      await vi.advanceTimersByTimeAsync(60_000);
    }
    await settle();
    expect(getListUrls()).toHaveLength(1);
  });
});
