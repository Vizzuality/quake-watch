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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp, userEvent } from 'vitest/browser';

import { subscribeGlobeSelect } from '@/containers/globe/globe-select';
import { HomeSheet } from '@/containers/home-sheet/home-sheet';
import { setLiveUpdatesPaused } from '@/lib/earthquakes/live-updates';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getIsHomeSheetOpen, setHomeSheetOpen } from '@/lib/layout/home-sheet-store';
import { getPhoneLayout } from '@/lib/layout/phone';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { setViewport } from '@/test/set-viewport';
import { stubFetch } from '@/test/stub-fetch';

const RANGE = {
  start: Date.parse('2026-10-26T00:00:00.000Z'),
  end: Date.parse('2026-11-02T00:00:00.000Z'),
};
const LAYOUT = getPhoneLayout(390, 844);

async function renderHomeSheet(initialEntry = '/') {
  stubFetch([
    {
      match: () => true,
      respond: () =>
        Response.json(
          getFeatureCollection([
            getEmscFeature({
              id: 'a',
              time: '2026-10-27T10:00:00.000Z',
              mag: 6.4,
              region: 'EASTER ISLAND REGION',
            }),
            getEmscFeature({ id: 'b', time: '2026-10-28T10:00:00.000Z', mag: 0.2 }),
            getEmscFeature({ id: 'c', time: '2026-10-30T10:00:00.000Z', mag: 3.1 }),
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
      <main className="relative h-dvh overflow-hidden">
        <HomeSheet />
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
  playbackClock.setRange(RANGE);
  const sheet = screen.container.querySelector('main > section');
  return { screen, router, sheet: sheet as HTMLElement };
}

function getTop(element: Element): number {
  return element.getBoundingClientRect().top;
}

describe('home sheet on phones', () => {
  beforeEach(async () => {
    await setViewport(390, 844);
    await cdp().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
  });

  afterEach(async () => {
    setHomeSheetOpen(false);
    setLiveUpdatesPaused(false);
    playbackClock.setRange(null);
    overwriteGetLocale(() => 'en');
    vi.useRealTimers();
    vi.restoreAllMocks();
    await cdp().send('Emulation.setEmulatedMedia', { features: [] });
    await setViewport(1280, 800);
  });

  it('shows the count, Likely felt, Largest, the live row and Filters & search when collapsed', async () => {
    const { screen, sheet } = await renderHomeSheet();

    await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('3');
    expect(getTop(sheet)).toBe(LAYOUT.homeSheetTop);
    await expect.element(screen.getByText('earthquakes this week.')).toBeVisible();
    await expect.element(screen.getByText('Likely felt', { exact: true })).toBeVisible();
    await expect.element(screen.getByRole('definition').nth(1)).toHaveTextContent('6.4');
    await expect.element(screen.getByText('Live · now')).toBeVisible();
    await expect.element(screen.getByText(/^Updated .+ ago · checks every minute$/)).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Filters & search' })).toBeVisible();

    expect(screen.getByRole('combobox', { name: 'Search a place' }).query()).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Time' }).query()).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Language' }).query()).toBeNull();
  });

  it('says the live row is paused while live updates are paused at 24h', async () => {
    const { screen } = await renderHomeSheet('/?interval=24h');
    await expect.element(screen.getByText('Live · now')).toBeVisible();

    setLiveUpdatesPaused(true);

    await expect.element(screen.getByText('Paused', { exact: true })).toBeVisible();
    await expect.element(screen.getByText(/^Updated .+ ago · updates paused$/)).toBeVisible();
  });

  it('opens from Filters & search with search, filters, the depth legend and the language group', async () => {
    const { screen, sheet } = await renderHomeSheet();
    const pill = screen.getByRole('button', { name: 'Filters & search' });

    await userEvent.click(pill);

    const handle = screen.getByRole('button', { name: 'Collapse the summary' });
    await expect.element(handle).toHaveAttribute('aria-expanded', 'true');
    await expect.element(handle).toHaveFocus();
    await expect.poll(() => getTop(sheet)).toBe(LAYOUT.homeSheetOpenTop);
    expect(getIsHomeSheetOpen()).toBe(true);
    await expect.element(screen.getByRole('combobox', { name: 'Search a place' })).toBeVisible();
    for (const name of ['Time', 'Magnitude', 'Depth', 'Source']) {
      await expect.element(screen.getByRole('radiogroup', { name })).toBeVisible();
    }
    expect(
      screen.getByRole('radiogroup', { name: 'Source' }).getByRole('radio').all(),
    ).toHaveLength(3);
    const scaleRow = screen.getByTestId('depth-legend').element().querySelector('[data-from]');
    expect(getComputedStyle(scaleRow as Element, '::before').content).toBe('"Surface"');
    expect(getComputedStyle(scaleRow as Element, '::after').content).toBe('"700 km"');
    expect(scaleRow?.getBoundingClientRect().width).toBe(350);
    const languages = screen.getByRole('navigation', { name: 'Language' });
    await expect.element(languages).toBeVisible();
    await expect
      .element(languages.getByRole('link', { name: 'Español' }))
      .toHaveAttribute('href', '/es');
    await expect
      .element(languages.getByRole('link', { name: 'Português' }))
      .toHaveAttribute('href', '/pt');
    await expect
      .element(screen.getByRole('button', { name: 'Filters & search' }))
      .not.toBeInTheDocument();
  });

  it('swaps the live row for the replay date and Pause while playing', async () => {
    const { screen } = await renderHomeSheet();

    await userEvent.click(screen.getByRole('button', { name: 'Play' }));

    await expect.element(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect.element(screen.getByText('drag the ring to scrub')).toBeVisible();
    expect(screen.getByText('Live · now').query()).toBeNull();
    playbackClock.goLive();
    await expect.element(screen.getByText('Live · now')).toBeVisible();
  });

  it('hands the largest Earthquake from the Largest tile to the globe like a tap', async () => {
    const { screen, router } = await renderHomeSheet();
    const onSelect = vi.fn<(earthquake: Earthquake) => void>();
    const unsubscribe = subscribeGlobeSelect(onSelect);

    await userEvent.click(screen.getByRole('button', { name: 'Open the largest earthquake' }));
    unsubscribe();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ source: 'emsc', id: 'a' });
    expect(router.state.location.search.quake).toBeUndefined();
  });

  it('opens the largest Earthquake through the URL when no globe is mounted', async () => {
    const { screen, router } = await renderHomeSheet();

    await userEvent.click(screen.getByRole('button', { name: 'Open the largest earthquake' }));

    await expect.poll(() => router.state.location.search.quake).toBe('emsc:a');
  });

  it('applies a filter while open and keeps the sheet open', async () => {
    const { screen, router } = await renderHomeSheet('/?interval=3d');
    setHomeSheetOpen(true);

    await userEvent.click(screen.getByText('4+', { exact: true }));

    await expect.poll(() => router.state.location.search.minmag).toBe(4);
    await expect
      .element(screen.getByRole('button', { name: 'Collapse the summary' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Español' }))
      .toHaveAttribute('href', '/es?interval=3d&minmag=4');
  });

  it('keeps every control in the open sheet at least 44×44 px', async () => {
    const { screen, sheet } = await renderHomeSheet();
    setHomeSheetOpen(true);
    await expect.element(screen.getByRole('combobox', { name: 'Search a place' })).toBeVisible();

    const targets = sheet.querySelectorAll('button, a, label, input[type="text"]');
    expect(targets.length).toBeGreaterThan(20);
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      if (rect.width === 0) continue;
      expect.soft(rect.width, target.outerHTML.slice(0, 80)).toBeGreaterThanOrEqual(44);
      expect.soft(rect.height, target.outerHTML.slice(0, 80)).toBeGreaterThanOrEqual(44);
    }
  });

  it.each(['en', 'es', 'pt'] as const)(
    'wraps the stat labels and the updated line instead of cutting them in %s',
    async (locale) => {
      overwriteGetLocale(() => locale);
      const { screen, sheet } = await renderHomeSheet();
      await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('3');
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + 39_000);
      await expect
        .poll(() => sheet.querySelector('[data-testid="live-updated"]')?.textContent, {
          timeout: 4000,
        })
        .toMatch(/\d/);

      const updated = sheet.querySelector('[data-testid="live-updated"]') as HTMLElement;
      const feltLabel = sheet.querySelector('dt span span') as HTMLElement;
      const cut = [updated, feltLabel].filter(
        (element) =>
          element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth,
      );
      expect(cut.map((element) => element.textContent)).toEqual([]);
    },
  );

  it('uses a 16 px search font so phones do not zoom on focus', async () => {
    const { screen } = await renderHomeSheet();
    setHomeSheetOpen(true);
    const search = screen.getByRole('combobox', { name: 'Search a place' });

    await expect.element(search).toBeVisible();
    expect(getComputedStyle(search.element()).fontSize).toBe('16px');
  });

  it('shows the expanded content while the handle is dragged and hides it again on release', async () => {
    const { screen } = await renderHomeSheet();
    const handle = screen.getByRole('button', { name: 'Expand the summary' }).element();
    const x = handle.getBoundingClientRect().left + 40;
    function pointer(type: string, y: number, time: number) {
      const event = new PointerEvent(type, {
        pointerId: 1,
        button: 0,
        clientX: x,
        clientY: y,
        bubbles: true,
      });
      Object.defineProperty(event, 'timeStamp', { value: time });
      handle.dispatchEvent(event);
    }

    pointer('pointerdown', 560, 1);
    pointer('pointermove', 530, 400);
    await expect.element(screen.getByRole('combobox', { name: 'Search a place' })).toBeVisible();

    pointer('pointerup', 530, 800);
    await expect
      .poll(() => screen.getByRole('combobox', { name: 'Search a place' }).query())
      .toBeNull();
  });

  it('runs the live row clock only on phones', async () => {
    await setViewport(1280, 800);
    const setInterval = vi.spyOn(window, 'setInterval');
    const { screen } = await renderHomeSheet();
    await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('3');

    expect(setInterval.mock.calls.filter(([, delay]) => delay === 1000)).toHaveLength(0);
  });

  it('moves focus to the handle when the detail closes and its opener is gone', async () => {
    const { screen, router } = await renderHomeSheet('/?quake=emsc:a');
    const handle = screen.getByRole('button', { name: 'Expand the summary' });
    (document.activeElement as HTMLElement | null)?.blur();

    await router.navigate({ to: '/', search: {} });

    await expect.element(handle).toHaveFocus();
  });

  it('leaves focus alone on a fresh load', async () => {
    const { screen } = await renderHomeSheet();

    await expect.element(screen.getByTestId('summary-count')).toBeVisible();
    expect(document.activeElement).toBe(document.body);
  });

  it('hides while an Earthquake is selected', async () => {
    const { sheet } = await renderHomeSheet('/?quake=emsc:a');

    expect(getComputedStyle(sheet).display).toBe('none');
  });
});

describe('home sheet on short landscape screens', () => {
  beforeEach(async () => {
    await setViewport(844, 390);
    await cdp().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
  });

  afterEach(async () => {
    setHomeSheetOpen(false);
    playbackClock.setRange(null);
    await cdp().send('Emulation.setEmulatedMedia', { features: [] });
    await setViewport(1280, 800);
  });

  it('docks the sheet right of the globe, collapsed and open', async () => {
    const { screen, sheet } = await renderHomeSheet();
    const { mapWidth } = getPhoneLayout(844, 390);

    await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('3');
    expect(sheet.getBoundingClientRect().toJSON()).toMatchObject({
      left: mapWidth,
      top: 0,
      right: 844,
      bottom: 390,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Filters & search' }));

    await expect.element(screen.getByRole('combobox', { name: 'Search a place' })).toBeVisible();
    expect(sheet.getBoundingClientRect().toJSON()).toMatchObject({ left: mapWidth, top: 0 });
  });
});
