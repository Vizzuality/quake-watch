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
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { AreaStrip } from '@/containers/detail-map/area-strip';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

const SELECTED_ID = '20261029_0000123';

async function renderStrip(initialEntry: string) {
  stubFetch([
    {
      match: () => true,
      respond: () =>
        Response.json(
          getFeatureCollection([
            getEmscFeature({
              id: SELECTED_ID,
              time: '2026-10-29T21:48:00.000Z',
              mag: 6.2,
              depth: 143,
              lat: -15,
              lon: 167.2,
            }),
            getEmscFeature({ id: 'near', mag: 4.3, lat: -16, lon: 167.2 }),
            getEmscFeature({ id: 'far', mag: 5, lat: 10, lon: 167.2 }),
          ]),
        ),
    },
  ]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: () => (
      <main className="relative h-dvh">
        <AreaStrip />
      </main>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  await router.load();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { screen, queryClient };
}

describe('area strip', () => {
  it('counts the selected earthquake and its neighbours, not the far ones', async () => {
    const { screen } = await renderStrip(`/?quake=emsc:${SELECTED_ID}`);

    await expect
      .element(screen.getByText('In this area this week · 2 earthquakes · Size = magnitude'))
      .toBeVisible();
    await expect
      .element(screen.getByTestId('area-strip-quake'))
      .toHaveTextContent('This earthquake · Thu 21:48');
    expect(screen.getByTestId('area-strip-dot').elements()).toHaveLength(1);
  });

  it('names the Interval it covers', async () => {
    const { screen } = await renderStrip(`/?quake=emsc:${SELECTED_ID}&interval=3d`);

    await expect
      .element(
        screen.getByText('In this area in the last 3 days · 2 earthquakes · Size = magnitude'),
      )
      .toBeVisible();
  });

  it('stays out of the way until an earthquake is selected', async () => {
    const { screen, queryClient } = await renderStrip('/');

    await expect.poll(() => queryClient.getQueryCache().getAll()[0]?.state.status).toBe('success');
    await expect.element(screen.getByTestId('area-strip')).not.toBeInTheDocument();
  });
});
