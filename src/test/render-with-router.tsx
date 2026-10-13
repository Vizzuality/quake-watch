import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { render } from 'vitest-browser-react';

import { earthquakeSearchSchema } from '@/lib/earthquakes/search-schema';

export async function renderWithRouter(component: () => ReactNode, initialEntry = '/') {
  const rootRoute = createRootRoute({ component: Outlet });
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: earthquakeSearchSchema,
    component,
  });
  const mapRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/map',
    validateSearch: earthquakeSearchSchema,
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute, mapRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await router.load();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { screen, router };
}
