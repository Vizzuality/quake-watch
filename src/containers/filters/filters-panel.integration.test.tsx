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
import { page, userEvent } from 'vitest/browser';

import { FiltersPanel } from '@/containers/filters/filters-panel';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { overwriteGetLocale } from '@/paraglide/runtime';

async function renderPanel(initialEntry = '/') {
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: () => (
      <main className="relative min-h-dvh">
        <FiltersPanel />
      </main>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  await router.load();
  const screen = await render(<RouterProvider router={router} />);
  return { router, screen };
}

describe('filters panel', () => {
  afterEach(async () => {
    overwriteGetLocale(() => 'en');
    await page.viewport(1280, 800);
  });

  it('matches the D1 frame geometry at 1440 px', async () => {
    await page.viewport(1440, 900);
    const { screen } = await renderPanel();
    const panel = screen.getByRole('region', { name: 'Filters' });
    await expect.element(panel).toBeVisible();

    const rect = panel.element().getBoundingClientRect();
    expect(rect.left).toBe(1154);
    expect(rect.top).toBe(159);
    expect(rect.width).toBe(230);
    expect(rect.height).toBe(301);
  });

  it('checks the defaults, styles them as Figma and keeps one tab stop per group', async () => {
    const { screen } = await renderPanel();

    for (const name of ['Time', 'Magnitude', 'Depth', 'Source']) {
      await expect.element(screen.getByRole('radiogroup', { name })).toBeVisible();
    }
    for (const name of ['7d', 'EMSC']) {
      await expect.element(screen.getByRole('radio', { name })).toBeChecked();
    }
    await expect.element(screen.getByRole('radio', { name: 'USGS' })).not.toBeChecked();
    expect(screen.container.querySelectorAll('input:checked')).toHaveLength(4);

    const active = getComputedStyle(screen.getByText('7d').element());
    expect(active.color).toBe('rgb(230, 228, 245)');
    expect(active.borderBottomColor).toBe('rgb(230, 228, 245)');
    expect(active.borderBottomWidth).toBe('1px');
    const inactive = getComputedStyle(screen.getByText('24h').element());
    expect(inactive.borderBottomColor).toBe('rgba(0, 0, 0, 0)');
    await userEvent.hover(screen.getByText('7d', { exact: true }));
    await expect.poll(() => active.color).toBe('rgb(235, 89, 142)');

    await userEvent.click(screen.getByText('7d', { exact: true }));
    await userEvent.keyboard('{Tab}');
    await expect.element(screen.getByRole('radio', { name: 'All' }).first()).toHaveFocus();
  });

  it('arrow keys move focus and write the param; a reload restores it', async () => {
    const { router, screen } = await renderPanel();
    const time = screen.getByRole('radiogroup', { name: 'Time' });

    await userEvent.click(time.getByText('7d', { exact: true }));
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => router.state.location.searchStr).toBe('?interval=24h');
    await expect.element(time.getByRole('radio', { name: '24h' })).toHaveFocus();
    await expect.element(time.getByRole('radio', { name: '24h' })).toBeChecked();

    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => router.state.location.searchStr).toBe('');

    await userEvent.click(screen.getByText('USGS', { exact: true }));
    await userEvent.click(screen.getByText('5+', { exact: true }));
    await userEvent.click(screen.getByText('Deep', { exact: true }));
    await expect
      .poll(() => router.state.location.searchStr)
      .toBe('?source=usgs&minmag=5&depth=deep');

    const href = router.state.location.href;
    screen.unmount();
    const reloaded = await renderPanel(href);
    for (const name of ['USGS', '5+', 'Deep', '7d']) {
      await expect.element(reloaded.screen.getByRole('radio', { name })).toBeChecked();
    }
  });

  it('hides while a quake is selected', async () => {
    const { screen } = await renderPanel('/?quake=usgs:us7000abcd');
    expect(screen.container.querySelector('section')).toBeNull();
  });

  it('renders in Spanish', async () => {
    overwriteGetLocale(() => 'es');
    const { screen } = await renderPanel();
    await expect.element(screen.getByRole('region', { name: 'Filtros' })).toBeVisible();
    await expect.element(screen.getByRole('radiogroup', { name: 'Profundidad' })).toBeVisible();
    await expect.element(screen.getByRole('radio', { name: 'Superficial' })).toBeVisible();
  });
});
