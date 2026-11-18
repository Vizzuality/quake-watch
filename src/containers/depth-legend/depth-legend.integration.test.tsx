import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';

import { DepthLegend } from '@/containers/depth-legend/depth-legend';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';

function expectWithinPixel(actual: number | undefined, expected: number) {
  expect(Math.abs((actual ?? Number.NaN) - expected)).toBeLessThanOrEqual(1);
}

const SELECTED_QUAKE = 'emsc:20261029_0000123';

async function renderLegend(initialEntry = '/') {
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: () => (
      <main className="relative h-dvh">
        <DepthLegend />
      </main>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  await router.load();
  const screen = await render(<RouterProvider router={router} />);
  return { screen, router };
}

describe('depth legend', () => {
  beforeEach(async () => {
    await page.viewport(1440, 900);
  });

  afterEach(async () => {
    await page.viewport(1280, 800);
  });

  it('shows the depth scale with a text alternative when no Earthquake is selected', async () => {
    const { screen } = await renderLegend();

    const legend = screen.getByRole('figure', { name: 'Depth scale, 0 km to 700 km' });
    await expect.element(legend).toBeVisible();
  });

  it('matches the D1 frame geometry at 1440×900', async () => {
    const { screen } = await renderLegend();
    await expect.element(screen.getByTestId('depth-legend')).toBeVisible();

    const legend = screen.getByTestId('depth-legend').element().getBoundingClientRect();
    const bar = screen.getByTestId('depth-legend-bar').element().getBoundingClientRect();
    const scale = screen.getByTestId('depth-legend-bar').element().closest('[aria-hidden]');
    const scaleRect = scale?.getBoundingClientRect();

    expectWithinPixel(legend.right, 1375);
    expectWithinPixel(scaleRect?.top, 613);
    expectWithinPixel(scaleRect?.bottom, 760);
    expectWithinPixel(bar.left, 1363.5);
    expect(bar.width).toBe(1.5);
    expectWithinPixel(bar.top, 613);
    expect(bar.height).toBe(147);
    const shallowest = screen.getByText('0 km', { exact: true }).element();
    const deepest = screen.getByText('700 km', { exact: true }).element();
    const shallowestRect = shallowest.getBoundingClientRect();
    const deepestRect = deepest.getBoundingClientRect();
    expectWithinPixel(shallowestRect.right, 1354);
    expectWithinPixel(shallowestRect.top, 613);
    expectWithinPixel(deepestRect.right, 1354);
    expectWithinPixel(deepestRect.top, 749);
    const label = getComputedStyle(shallowest);
    expect(label.fontSize).toBe('9px');
    expect(label.fontWeight).toBe('500');
    expect(label.letterSpacing).toBe('1.62px');
  });

  it('hides when an Earthquake is selected and returns when it is cleared', async () => {
    const { screen, router } = await renderLegend(`/?quake=${SELECTED_QUAKE}`);
    const legend = screen.getByTestId('depth-legend');

    await expect.element(legend).not.toBeVisible();
    await expect.element(legend).toHaveAttribute('aria-hidden', 'true');

    await router.navigate({ to: '/', search: (prev) => ({ ...prev, quake: undefined }) });

    await expect.element(legend).toBeVisible();
  });
});
