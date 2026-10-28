import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { DetailNotFound } from '@/containers/earthquake-detail/shared/detail-not-found';
import { NotFoundComponent } from '@/containers/errors/not-found-component';
import { overwriteGetLocale } from '@/paraglide/runtime';

async function renderAt(element: ReactNode) {
  const rootRoute = createRootRoute();
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/nope',
    component: () => element,
  });
  const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' });
  const router = createRouter({
    routeTree: rootRoute.addChildren([pageRoute, homeRoute]),
    history: createMemoryHistory({ initialEntries: ['/nope'] }),
  });
  await router.load();
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('404 pages', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
  });

  afterEach(() => {
    overwriteGetLocale(() => 'en');
  });

  it('general 404 shows the heading, the nothing-recorded line and a link home', async () => {
    const screen = await renderAt(<NotFoundComponent />);

    await expect.element(screen.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect.element(screen.getByText('Nothing recorded at this address.')).toBeVisible();
    const heading = screen.getByRole('heading', { name: 'Page not found' }).element();
    const drum = screen.container.querySelector('[data-drum]');
    expect(drum && heading.compareDocumentPosition(drum)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const link = screen.getByRole('link', { name: 'See all Earthquakes' });
    await expect.element(link).toHaveAttribute('href', '/');
  });

  it('detail 404 names the agency and leaves the way back to the layout link', async () => {
    const screen = await renderAt(<DetailNotFound source="usgs" />);

    await expect
      .element(screen.getByRole('heading', { name: 'Earthquake not found' }))
      .toBeVisible();
    await expect.element(screen.getByText('Nothing recorded at this address.')).toBeVisible();
    await expect
      .element(
        screen.getByText('The link may be mistyped, or USGS may have removed this Earthquake.'),
      )
      .toBeVisible();
    expect(screen.getByRole('link', { name: 'See all Earthquakes' }).elements()).toHaveLength(0);
  });

  it('uses Spanish copy under es', async () => {
    overwriteGetLocale(() => 'es');
    const screen = await renderAt(<NotFoundComponent />);

    await expect.element(screen.getByText('Nada registrado en esta dirección.')).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Ver todos los terremotos' }))
      .toBeVisible();
  });
});
