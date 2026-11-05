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

export async function renderWithRouter(component: () => ReactNode) {
  const rootRoute = createRootRoute({ component: Outlet });
  const pageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  const screen = await render(<RouterProvider router={router} />);
  return { screen, router };
}
