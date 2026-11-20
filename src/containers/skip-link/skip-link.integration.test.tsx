import '@/styles.css';
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
import { userEvent } from 'vitest/browser';

import { SkipLink } from '@/containers/skip-link/skip-link';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { DETAILS_HEADING_ID, MAIN_ID, SUMMARY_ID } from '@/lib/layout/skip-targets';

function Page() {
  return (
    <>
      <SkipLink />
      <header>
        <button type="button">About</button>
      </header>
      <main id={MAIN_ID}>
        <section id={SUMMARY_ID} tabIndex={-1} aria-label="Summary">
          <button type="button">More about Likely felt</button>
        </section>
        <h2 id={DETAILS_HEADING_ID}>Magnitude 5.0 Earthquake</h2>
      </main>
    </>
  );
}

async function renderPage(initialEntry: string) {
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: Page,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

describe('skip link', () => {
  it('is the first Tab stop, shows on focus and moves focus to the summary', async () => {
    const screen = await renderPage('/');
    const link = screen.getByRole('link', { name: 'Skip to summary' });

    await userEvent.tab();

    await expect.element(link).toHaveFocus();
    expect(link.element().getBoundingClientRect().width).toBeGreaterThan(24);
    await userEvent.keyboard('{Enter}');
    await expect.element(screen.getByRole('region', { name: 'Summary' })).toHaveFocus();
    await userEvent.tab();
    await expect
      .element(screen.getByRole('button', { name: 'More about Likely felt' }))
      .toHaveFocus();
  });

  it('skips to the Earthquake details heading while one is selected', async () => {
    const screen = await renderPage('/?quake=emsc:20261120_0000159');
    const link = screen.getByRole('link', { name: 'Skip to earthquake details' });

    await userEvent.tab();
    await expect.element(link).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    await expect
      .element(screen.getByRole('heading', { name: 'Magnitude 5.0 Earthquake' }))
      .toHaveFocus();
  });
});
