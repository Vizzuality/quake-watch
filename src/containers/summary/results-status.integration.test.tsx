import '@/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { ResultsStatus } from '@/containers/summary/results-status';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

const FEATURES = [
  getEmscFeature({ id: 'a', time: '2026-10-27T10:00:00.000Z', mag: 6.4 }),
  getEmscFeature({ id: 'b', time: '2026-10-28T10:00:00.000Z', mag: 0.2 }),
  getEmscFeature({ id: 'c', time: '2026-10-30T10:00:00.000Z', mag: 3.1 }),
];

async function renderStatus() {
  stubFetch([
    {
      match: (url) => url.searchParams.get('minmagnitude') === '3',
      respond: () =>
        Response.json(
          getFeatureCollection(FEATURES.filter(({ properties }) => properties.mag >= 3)),
        ),
    },
    { match: () => true, respond: () => Response.json(getFeatureCollection(FEATURES)) },
  ]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: ResultsStatus,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { screen, router };
}

describe('results status', () => {
  afterEach(() => {
    playbackClock.setRange(null);
  });

  it('keeps one status region that reads the total count for the filters', async () => {
    const { screen, router } = await renderStatus();
    const status = screen.getByRole('status');

    await expect.element(status).toHaveTextContent('3 earthquakes this week.');
    const region = status.element();

    await router.navigate({ to: '/', search: (prev) => ({ ...prev, minmag: 3 }) });

    await expect.element(status).toHaveTextContent('2 earthquakes this week.');
    expect(status.element()).toBe(region);
  });

  it('ignores the playhead, so playback never announces', async () => {
    const { screen } = await renderStatus();
    const status = screen.getByRole('status');
    await expect.element(status).toHaveTextContent('3 earthquakes this week.');

    playbackClock.setRange({
      start: Date.parse('2026-10-26T00:00:00.000Z'),
      end: Date.parse('2026-11-02T00:00:00.000Z'),
    });
    playbackClock.seek(Date.parse('2026-10-27T12:00:00.000Z'));

    await expect.element(status).toHaveTextContent('3 earthquakes this week.');
  });
});
