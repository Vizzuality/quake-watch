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

import { AreaStrip } from '@/containers/detail-map/area-strip';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { getPhoneLayout } from '@/lib/layout/phone';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { setViewport } from '@/test/set-viewport';
import { stubFetch } from '@/test/stub-fetch';

const SELECTED_ID = '20261029_0000123';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function renderStrip(initialEntry: string, time = '2026-10-29T21:48:00.000Z') {
  stubFetch([
    {
      match: () => true,
      respond: () =>
        Response.json(
          getFeatureCollection([
            getEmscFeature({
              id: SELECTED_ID,
              time,
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

describe('area strip on phones', () => {
  afterEach(async () => {
    overwriteGetLocale(() => 'en');
    await setViewport(1280, 800);
  });

  it.each([
    [390, 844],
    [320, 640],
  ])(
    'sits inside 22 px margins just above the detail sheet, with the quake label inside it, at %ix%i',
    async (width, height) => {
      await setViewport(width, height);
      const { screen } = await renderStrip(
        `/?quake=emsc:${SELECTED_ID}`,
        new Date(Date.now() - 0.38 * WEEK_MS).toISOString(),
      );
      const label = screen.getByTestId('area-strip-quake');
      await expect.element(label).toBeVisible();

      const strip = screen.getByTestId('area-strip').element().getBoundingClientRect();
      const { detailSheetTop } = getPhoneLayout(width, height);
      expect(strip.left).toBe(22);
      expect(strip.right).toBe(width - 22);
      expect(strip.bottom).toBeLessThanOrEqual(detailSheetTop);
      expect(strip.bottom).toBeGreaterThan(detailSheetTop - 12);
      const labelRect = label.element().getBoundingClientRect();
      expect(labelRect.left).toBeGreaterThanOrEqual(strip.left);
      expect(labelRect.right).toBeLessThanOrEqual(strip.right);
      const caption = screen.getByRole('figure').element().querySelector('figcaption');
      expect(caption?.getBoundingClientRect().right).toBeLessThanOrEqual(strip.right);
    },
  );

  it.each([
    [360, 740, 'es'],
    [320, 640, 'en'],
    [320, 640, 'pt'],
  ] as const)(
    'thins the day labels so none touch and all stay inside 16 px margins at %ix%i in %s',
    async (width, height, locale) => {
      await setViewport(width, height);
      overwriteGetLocale(() => locale);
      const { screen } = await renderStrip(`/?quake=emsc:${SELECTED_ID}`, new Date().toISOString());
      await expect.element(screen.getByTestId('area-strip-quake')).toBeVisible();

      const ticks = [
        ...screen.getByTestId('area-strip').element().querySelectorAll('[data-strip-tick]'),
      ];
      const shown = ticks
        .filter((tick) => getComputedStyle(tick).visibility === 'visible')
        .map((tick) => tick.getBoundingClientRect());
      expect(shown.length).toBeGreaterThanOrEqual(3);
      for (const rect of shown) {
        expect.soft(rect.left).toBeGreaterThanOrEqual(16);
        expect.soft(rect.right).toBeLessThanOrEqual(width - 16);
      }
      const gaps = shown.slice(1).map((rect, index) => rect.left - shown[index].right);
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(8);
    },
  );
});
