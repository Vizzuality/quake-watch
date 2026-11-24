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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { setWavePaused } from '@/containers/globe/wave-pause';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { CRUST_CELL_COUNT, getCrustLayersBuffer } from '@/lib/section/crust-layers';
import { getIsSectionShown } from '@/lib/section/section-shown-store';
import { getSlabGridsBuffer } from '@/lib/section/slab-depth';
import { TERRARIUM_TILE_URL, TILE_SIZE } from '@/lib/section/terrarium';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { setViewport } from '@/test/set-viewport';
import { stubFetch } from '@/test/stub-fetch';

import { PULSE_RINGS } from './section-figure';
import SectionView, { SectionNote } from './section-view';
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
    <>
      <main className="relative h-dvh">
        <div className="relative z-10">
          <ViewToggle />
        </div>
        {view === 'section' && <SectionView quake={QUAKE} />}
      </main>
      <aside>{view === 'section' && <SectionNote quake={QUAKE} />}</aside>
    </>
  );
}

type Rect = { left: number; right: number; top: number; bottom: number };

function isOverlapping(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function getRect(element: Element): Rect {
  const { left, right, top, bottom } = element.getBoundingClientRect();
  return { left, right, top, bottom };
}

function getLabelRects(): { text: string; rect: Rect; fontPx: number }[] {
  const figure = document.querySelector('[data-testid="section-figure"]');
  const svg = figure as SVGSVGElement;
  const pxPerUnit = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
  return Array.from(figure?.querySelectorAll('text:not([data-halo])') ?? []).map((text) => ({
    text: text.textContent ?? '',
    rect: getRect(text),
    fontPx: Number.parseFloat(getComputedStyle(text).fontSize) * pxPerUnit,
  }));
}

async function waitForPhoneFigure() {
  await expect
    .poll(() => {
      const figure = document.querySelector('[data-testid="section-figure"]');
      const isDesktop = figure?.getAttribute('viewBox') === '480 200 960 530';
      return (
        figure !== null && !isDesktop && !figure.querySelector('[data-testid="section-legend"]')
      );
    })
    .toBe(true);
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

  it('reports itself shown only while it covers the map', async () => {
    const { screen } = await renderSection(`/?quake=${QUAKE}&view=section`);

    await expect.poll(getIsSectionShown).toBe(true);

    await setViewport(900, 800);
    await expect.poll(getIsSectionShown).toBe(false);

    await setViewport(390, 844);
    await expect.poll(getIsSectionShown).toBe(true);

    await setViewport(1280, 800);
    await screen.getByText('Map', { exact: true }).click();
    await expect.poll(getIsSectionShown).toBe(false);
  });

  it('draws the slice with its layers, plate, neighbours and a text alternative', async () => {
    const { screen } = await renderSection(`/?quake=${QUAKE}&view=section`);

    await expect.element(screen.getByTestId('section-figure')).toBeInTheDocument();
    await expect
      .element(
        screen
          .getByTestId('section-view')
          .getByText(/top of the sinking plate from USGS Slab2, earthquakes from EMSC/),
      )
      .toBeVisible();
    await expect.element(screen.getByText('M6.2 · 143 KM').last()).toBeInTheDocument();
    await expect.element(screen.getByText('TOP OF THE SINKING PLATE').first()).toBeInTheDocument();
    await expect
      .element(screen.getByTestId('section-view').getByText('LAYERS · CRUST1.0'))
      .toBeInTheDocument();
    expect(screen.getByTestId('section-other').elements()).toHaveLength(1);
    await expect
      .element(
        screen.getByRole('figure', {
          name: /which started 143 km down in the mantle\. The sea floor above it lies 2 km below sea level\./,
        }),
      )
      .toBeInTheDocument();
  });

  it('holds the wave rings still while the wave is paused and loops them again on play', async () => {
    const { screen } = await renderSection(`/?quake=${QUAKE}&view=section`);
    await expect.element(screen.getByTestId('section-figure')).toBeInTheDocument();
    const rings = screen
      .getByTestId('section-figure')
      .element()
      .querySelectorAll('g[clip-path] > circle');
    function getRadii() {
      return [...rings].map((circle) => Number(circle.getAttribute('r')));
    }

    setWavePaused(true);
    await expect.poll(getRadii).toEqual(PULSE_RINGS.map(({ radius }) => radius));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(getRadii()).toEqual(PULSE_RINGS.map(({ radius }) => radius));

    setWavePaused(false);
    await expect.poll(getRadii).not.toEqual(PULSE_RINGS.map(({ radius }) => radius));
    setWavePaused(null);
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

  describe('on phones', () => {
    afterEach(async () => {
      await setViewport(1280, 800);
    });

    it.each([
      [390, 844, 558],
      [320, 640, 354],
    ])(
      'fills the band under the action row and above the collapsed sheet at %ix%i',
      async (width, height, bandBottom) => {
        await setViewport(width, height);
        const { screen } = await renderSection(`/?quake=${QUAKE}&view=section`);
        const figure = screen.getByRole('figure');

        await waitForPhoneFigure();
        const rect = getRect(figure.element());

        expect(rect.top).toBeCloseTo(136, 0);
        expect(rect.bottom).toBeCloseTo(bandBottom, 0);
        expect(rect.left).toBeCloseTo(16, 0);
        expect(rect.right).toBeCloseTo(width - 16, 0);
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      },
    );

    it.each([
      [390, 844],
      [320, 640],
    ])(
      'keeps every label at 10 px or more, inside the figure and clear of the others at %ix%i',
      async (width, height) => {
        await setViewport(width, height);
        const { screen } = await renderSection(`/?quake=${QUAKE}&view=section`);

        await waitForPhoneFigure();
        await expect.element(screen.getByText('M6.2 · 143 KM').last()).toBeVisible();
        await expect.element(screen.getByText('SEA LEVEL').last()).toBeVisible();
        await expect
          .element(
            screen.getByTestId('section-figure').getByText('TOP OF THE SINKING PLATE').last(),
          )
          .toBeVisible();
        await expect.poll(() => getLabelRects().length).toBeGreaterThan(4);
        const figure = getRect(screen.getByTestId('section-figure').element());
        const labels = getLabelRects();

        const small = labels.filter(({ fontPx }) => fontPx < 10 - 0.01).map(({ text }) => text);
        const clipped = labels
          .filter(
            ({ rect }) =>
              rect.left < figure.left - 0.5 ||
              rect.right > figure.right + 0.5 ||
              rect.top < figure.top - 0.5 ||
              rect.bottom > figure.bottom + 0.5,
          )
          .map(({ text }) => text);
        const overlaps = labels.flatMap((a, index) =>
          labels
            .slice(index + 1)
            .filter((b) => isOverlapping(a.rect, b.rect))
            .map((b) => `${a.text} / ${b.text}`),
        );

        expect(small).toEqual([]);
        expect(clipped).toEqual([]);
        expect(overlaps).toEqual([]);
      },
    );

    it('moves the heading, sources and legend into the detail sheet', async () => {
      await setViewport(390, 844);
      const { screen } = await renderSection(`/?quake=${QUAKE}&view=section`);
      const note = screen.getByTestId('section-note');

      await waitForPhoneFigure();

      await expect
        .element(note.getByRole('heading', { name: "What's under this earthquake" }))
        .toBeInTheDocument();
      await expect
        .element(note.getByText(/the top of the sinking plate from USGS Slab2/))
        .toBeInTheDocument();
      await expect.element(note.getByText('LAYERS · CRUST1.0')).toBeInTheDocument();
      await expect.element(note.getByText('MIDDLE CRUST')).toBeInTheDocument();
      expect(screen.getByTestId('section-legend').query()).toBeNull();
    });

    it('switches Map → Section → Map from the toggle', async () => {
      await setViewport(390, 844);
      const { screen, router } = await renderSection(`/?quake=${QUAKE}`);

      await screen.getByText('Section', { exact: true }).click();

      await waitForPhoneFigure();
      expect(router.state.location.search).toMatchObject({ view: 'section' });

      await screen.getByText('Map', { exact: true }).click();

      expect(screen.getByTestId('section-view').query()).toBeNull();
      expect(router.state.location.search).not.toHaveProperty('view');
    });

    it('shows the error and its retry inside the band', async () => {
      await setViewport(320, 640);
      const { screen } = await renderSection(`/?quake=${QUAKE}&view=section`, {
        tilesFail: true,
      });
      const alert = screen.getByRole('alert');

      await expect.element(alert.getByText(/^The slice couldn't load\./)).toBeVisible();
      const rect = getRect(alert.element());
      const button = screen.getByRole('button', { name: 'Try again' }).element();
      const retry = getRect(button);
      const centreX = (retry.left + retry.right) / 2;
      const centreY = (retry.top + retry.bottom) / 2;

      expect(rect.top).toBeGreaterThanOrEqual(136 - 0.5);
      expect(rect.bottom).toBeLessThanOrEqual(354 + 0.5);
      expect(retry.left).toBeGreaterThanOrEqual(16);
      expect(retry.right).toBeLessThanOrEqual(304);
      expect(retry.bottom - retry.top).toBeGreaterThanOrEqual(34);
      expect(document.elementFromPoint(centreX, centreY - 21.5)).toBe(button);
      expect(document.elementFromPoint(centreX, centreY + 21.5)).toBe(button);
    });
  });
});
