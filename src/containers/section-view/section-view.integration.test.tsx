import '@/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  getRouteApi,
} from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { CRUST_CELL_COUNT, getCrustLayersBuffer } from '@/lib/section/crust-layers';
import { getSlabGridsBuffer } from '@/lib/section/slab-depth';
import { TERRARIUM_TILE_URL, TILE_SIZE } from '@/lib/section/terrarium';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

import SectionView from './section-view';
import { ViewToggle } from './view-toggle';

const QUAKE = 'emsc:20261029_0000123';
const homeRoute = getRouteApi('/');

const CRUST_BYTES = getCrustLayersBuffer(
  Array.from({ length: CRUST_CELL_COUNT }, () => ({
    sedimentsKm: 1,
    upperKm: 6,
    middleKm: 6,
    lowerKm: 7,
  })),
);
const SLAB_BYTES = getSlabGridsBuffer([
  {
    west: 166,
    south: -17,
    step: 1,
    columns: 4,
    rows: 3,
    depthsKm: [10, 60, 110, 160, 10, 60, 110, 160, 10, 60, 110, 160],
  },
]);

async function getSeaFloorTile(): Promise<Blob> {
  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas');
  context.fillStyle = 'rgb(120 48 0)';
  context.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  return canvas.convertToBlob({ type: 'image/png' });
}

function DetailHarness() {
  const { view } = homeRoute.useSearch();
  return (
    <main className="relative h-dvh">
      <ViewToggle />
      {view === 'section' && <SectionView quake={QUAKE} />}
    </main>
  );
}

async function renderSection(initialEntry: string, { tilesFail = false } = {}) {
  const tile = await getSeaFloorTile();
  const routedFetch = stubFetch([
    {
      match: (url) => url.href.startsWith(TERRARIUM_TILE_URL),
      respond: () => (tilesFail ? new Response('down', { status: 503 }) : new Response(tile)),
    },
    { match: (url) => url.pathname.includes('crust1'), respond: () => new Response(CRUST_BYTES) },
    { match: (url) => url.pathname.includes('slab2'), respond: () => new Response(SLAB_BYTES) },
    {
      match: () => true,
      respond: () =>
        Response.json(
          getFeatureCollection([
            getEmscFeature({
              id: '20261029_0000123',
              time: '2026-10-29T21:48:00.000Z',
              mag: 6.2,
              depth: 143,
              lat: -15.5,
              lon: 167.5,
            }),
            getEmscFeature({ id: 'near', mag: 4.3, depth: 40, lat: -15.6, lon: 167 }),
            getEmscFeature({ id: 'far', mag: 5, lat: 10, lon: 167.2 }),
          ]),
        ),
    },
  ]);
  const fetchMock = vi.fn<typeof fetch>((input, init) =>
    routedFetch(typeof input === 'string' ? new URL(input, location.href) : input, init),
  );
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: DetailHarness,
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
  return { screen, router, fetchMock };
}

describe('section view', () => {
  it('switches between Map and Section from a radio group and keeps the choice in the URL', async () => {
    const { screen, router } = await renderSection(`/?quake=${QUAKE}`);
    const map = screen.getByRole('radio', { name: 'Map' });
    const section = screen.getByRole('radio', { name: 'Section' });

    await expect.element(screen.getByRole('group', { name: 'View' })).toBeVisible();
    await expect.element(map).toBeChecked();

    await screen.getByText('Section', { exact: true }).click();

    await expect.element(section).toBeChecked();
    expect(router.state.location.search).toMatchObject({ view: 'section' });
    await expect
      .element(screen.getByRole('heading', { name: "What's under this earthquake" }))
      .toBeVisible();

    await userEvent.keyboard('{ArrowLeft}');

    await expect.element(map).toBeChecked();
    expect(router.state.location.search).not.toHaveProperty('view');
    expect(screen.getByTestId('section-view').query()).toBeNull();
  });

  it('draws the slice with its layers, plate, neighbours and a text alternative', async () => {
    const { screen } = await renderSection(`/?quake=${QUAKE}&view=section`);

    await expect.element(screen.getByTestId('section-figure')).toBeInTheDocument();
    await expect
      .element(screen.getByText(/top of the sinking plate from USGS Slab2, earthquakes from EMSC/))
      .toBeVisible();
    await expect.element(screen.getByText('M6.2 · 143 KM')).toBeInTheDocument();
    await expect.element(screen.getByText('TOP OF THE SINKING PLATE').first()).toBeInTheDocument();
    await expect.element(screen.getByText('LAYERS · CRUST1.0')).toBeInTheDocument();
    expect(screen.getByTestId('section-other').elements()).toHaveLength(1);
    await expect
      .element(
        screen.getByRole('figure', {
          name: /which started 143 km down in the mantle\. The sea floor above it lies 2 km below sea level\./,
        }),
      )
      .toBeInTheDocument();
  });

  it('shows an inline error with a retry when the relief cannot load', async () => {
    const { screen, fetchMock } = await renderSection(`/?quake=${QUAKE}&view=section`, {
      tilesFail: true,
    });

    await expect
      .element(screen.getByRole('alert').getByText(/^The slice couldn't load\./))
      .toBeVisible();
    const callsBefore = fetchMock.mock.calls.length;

    await screen.getByRole('button', { name: 'Try again' }).click();

    await expect.poll(() => fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(screen.getByTestId('section-figure').query()).toBeNull();
  });
});
