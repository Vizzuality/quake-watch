import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';

import { usgsEarthquakeDetailQueryOptions } from '@/lib/earthquakes/details/usgs-query-options';

import { DetailErrorPage } from './detail-route-states';

const ID = 'us6000u18k';
const QUERY_KEY = usgsEarthquakeDetailQueryOptions(ID).queryKey;

async function renderErrorPage(queryClient: QueryClient) {
  const rootRoute = createRootRoute();
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/earthquakes/usgs/$earthquakeId',
    component: () => <DetailErrorPage source="usgs" queryKey={QUERY_KEY} />,
  });
  const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' });
  const router = createRouter({
    routeTree: rootRoute.addChildren([detailRoute, homeRoute]),
    history: createMemoryHistory({ initialEntries: [`/earthquakes/usgs/${ID}`] }),
  });
  await router.load();
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('DetailErrorPage', () => {
  it('offers a retry when the agency request is what failed', async () => {
    const queryClient = new QueryClient();
    await queryClient.prefetchQuery({
      queryKey: QUERY_KEY,
      queryFn: () => Promise.reject(new Error('USGS request failed with status 503')),
      retry: false,
    });
    const screen = await renderErrorPage(queryClient);

    await expect.element(screen.getByText("Couldn't reach USGS.")).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  it('falls back to the app error page when the Earthquake loaded but rendering failed', async () => {
    const queryClient = new QueryClient();
    const screen = await renderErrorPage(queryClient);

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Something went wrong' }))
      .toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' }).elements()).toHaveLength(0);
  });
});
