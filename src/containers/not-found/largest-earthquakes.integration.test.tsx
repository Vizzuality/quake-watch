import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { earthquakesQueryOptions } from '@/lib/earthquakes/query-options';
import { EARTHQUAKE_SEARCH_DEFAULTS } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';

import { LargestEarthquakes } from './largest-earthquakes';

const QUERY_KEY = earthquakesQueryOptions({
  ...EARTHQUAKE_SEARCH_DEFAULTS,
  source: 'usgs',
}).queryKey;

function getEarthquake(id: string, magnitude: number): Earthquake {
  return {
    id,
    source: 'usgs',
    magnitude,
    magnitudeType: 'mb',
    place: `Place ${id}`,
    time: Date.now() - 3_600_000,
    depthKm: 10,
    longitude: 0,
    latitude: 0,
    url: '',
  };
}

async function renderList(queryClient: QueryClient) {
  const rootRoute = createRootRoute();
  const notFoundRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/nope',
    component: () => <LargestEarthquakes source="usgs" />,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/earthquakes/usgs/$earthquakeId',
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([notFoundRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/nope'] }),
  });
  await router.load();
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function getQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('LargestEarthquakes', () => {
  it('links each of the 5 largest to its detail page', async () => {
    const queryClient = getQueryClient();
    const magnitudes = [3.1, 5.6, 4.2, 6.0, 2.8, 4.9, 3.3];
    queryClient.setQueryData(QUERY_KEY, {
      earthquakes: magnitudes.map((magnitude, index) => getEarthquake(`us${index}`, magnitude)),
      isTruncated: false,
      fetchedAt: Date.now(),
    });
    const screen = await renderList(queryClient);

    await expect
      .element(screen.getByText('Largest Earthquakes in the last 24 h · USGS'))
      .toBeVisible();
    const links = screen.getByRole('link').elements();
    expect(links).toHaveLength(5);
    expect(links[0]?.getAttribute('href')).toBe('/earthquakes/usgs/us3');
    expect(links[0]?.textContent).toContain('6.0');
  });

  it('times each row against when the list was fetched', async () => {
    const queryClient = getQueryClient();
    const fetchedAt = Date.now() - 10 * 3_600_000;
    queryClient.setQueryData(
      QUERY_KEY,
      {
        earthquakes: [{ ...getEarthquake('us1', 5), time: fetchedAt - 2 * 3_600_000 }],
        isTruncated: false,
        fetchedAt,
      },
      { updatedAt: fetchedAt },
    );
    const screen = await renderList(queryClient);

    await expect.element(screen.getByText('2 hours ago')).toBeVisible();
  });

  it('shows a skeleton while loading', async () => {
    const queryClient = getQueryClient();
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    const screen = await renderList(queryClient);

    await expect
      .poll(() => screen.container.querySelectorAll('span[aria-hidden="true"]').length)
      .toBe(10);
    expect(screen.container.querySelectorAll('a')).toHaveLength(0);
  });

  it('renders nothing when the agency fails', async () => {
    const queryClient = getQueryClient();
    await queryClient.prefetchQuery({
      queryKey: QUERY_KEY,
      queryFn: () => Promise.reject(new Error('USGS request failed with status 503')),
    });
    const screen = await renderList(queryClient);

    await expect.poll(() => screen.container.textContent).toBe('');
  });

  it('renders nothing when there are no earthquakes', async () => {
    const queryClient = getQueryClient();
    queryClient.setQueryData(QUERY_KEY, { earthquakes: [], isTruncated: false, fetchedAt: 0 });
    const screen = await renderList(queryClient);

    await expect.poll(() => screen.container.textContent).toBe('');
  });
});
