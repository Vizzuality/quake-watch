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
import { RightRail } from '@/containers/home-sheet/right-rail';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';

function expectWithinPixel(actual: number | undefined, expected: number) {
  expect(Math.abs((actual ?? Number.NaN) - expected)).toBeLessThanOrEqual(1);
}

const SELECTED_QUAKE = 'emsc:20261029_0000123';

async function renderLegend(initialEntry = '/', filtersHeight = 0) {
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: () => (
      <main className="relative h-dvh">
        <RightRail>
          {filtersHeight > 0 && (
            <div
              data-testid="filters-stand-in"
              className="w-[230px] shrink-0"
              style={{ height: filtersHeight }}
            />
          )}
          <DepthLegend />
        </RightRail>
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

    const legend = screen.getByTestId('depth-legend-column').element().getBoundingClientRect();
    const bar = screen.getByTestId('depth-legend-bar').element().getBoundingClientRect();
    const scale = screen.getByTestId('depth-legend-bar').element().parentElement?.parentElement;
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

  it.each([
    [1366, 768],
    [1280, 720],
  ])('stays below a 325 px filters panel at %ix%i', async (width, height) => {
    await page.viewport(width, height);
    const { screen } = await renderLegend('/', 325);
    await expect.element(screen.getByTestId('depth-legend')).toBeVisible();

    const filters = screen.getByTestId('filters-stand-in').element().getBoundingClientRect();
    const shown = [
      screen.getByTestId('depth-legend-row'),
      screen.getByTestId('depth-legend-column'),
    ]
      .map((locator) => locator.element().getBoundingClientRect())
      .filter((rect) => rect.height > 0);
    expect(shown).toHaveLength(1);
    expect(shown[0].top).toBeGreaterThanOrEqual(filters.bottom + 12);
    expect(shown[0].bottom).toBeLessThanOrEqual(height - 114);
  });

  it('hides when not even the horizontal row fits below the filters', async () => {
    await page.viewport(1024, 600);
    const { screen } = await renderLegend('/', 325);
    await expect.element(screen.getByTestId('depth-legend-row')).not.toBeVisible();
    await expect.element(screen.getByTestId('depth-legend-column')).not.toBeVisible();
  });

  it('swaps to the horizontal row when less than 11rem is left below the filters', async () => {
    await page.viewport(1366, 700);
    const { screen } = await renderLegend('/', 325);
    await expect.element(screen.getByTestId('depth-legend-row')).toBeVisible();
    await expect.element(screen.getByTestId('depth-legend-column')).not.toBeVisible();
  });

  it('shortens the vertical bar before swapping', async () => {
    await page.viewport(1440, 800);
    const { screen } = await renderLegend('/', 325);
    await expect.element(screen.getByTestId('depth-legend-column')).toBeVisible();
    const bar = screen.getByTestId('depth-legend-bar').element().getBoundingClientRect();
    expect(bar.height).toBeGreaterThanOrEqual(40);
    expect(bar.height).toBeLessThan(147);
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
