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

import { subscribeGlobeFlyTo } from '@/containers/globe/globe-fly-to';
import { subscribeGlobeSelect } from '@/containers/globe/globe-select';
import { LiveBanner } from '@/containers/live-banner/live-banner';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import type { Earthquake } from '@/lib/earthquakes/types';
import { setHomeSheetHandle, setHomeSheetOpen } from '@/lib/layout/home-sheet-store';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { setViewport } from '@/test/set-viewport';
import { stubFetch } from '@/test/stub-fetch';

type Feature = ReturnType<typeof getEmscFeature>;

const OLD = getEmscFeature({ id: 'old', time: '2026-11-19T08:00:00Z', mag: 5.5, depth: 10 });
const NOTEWORTHY = getEmscFeature({
  id: 'strong',
  time: '2026-11-19T09:00:00Z',
  mag: 4.7,
  depth: 10,
  region: 'EASTERN XIZANG',
});
const SMALL = getEmscFeature({ id: 'small', time: '2026-11-19T09:30:00Z', mag: 3, depth: 500 });
const AUTO_DISMISS_MS = 15_000;
const ANNOUNCEMENT = 'New earthquake · M4.7. Eastern Xizang. Just now · 10 km deep';

async function renderBanner() {
  const features: Feature[] = [OLD];
  stubFetch([
    { match: () => true, respond: () => Response.json(getFeatureCollection([...features])) },
  ]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: () => (
      <main className="relative h-dvh overflow-hidden">
        <button type="button" ref={setHomeSheetHandle}>
          Sheet handle
        </button>
        <LiveBanner />
      </main>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await expect.poll(() => queryClient.isFetching()).toBe(0);
  await expect.poll(() => queryClient.getQueryCache().getAll()[0]?.state.status).toBe('success');

  async function arrive(...arrivals: Feature[]) {
    features.push(...arrivals);
    await queryClient.refetchQueries();
  }

  const announcer = screen.container.querySelector('output') as HTMLOutputElement;
  const getAnnouncement = () => announcer.textContent;
  const getBanner = (): HTMLElement | null =>
    screen.getByRole('button', { name: 'Dismiss' }).query()?.parentElement ?? null;
  return { screen, router, announcer, getAnnouncement, getBanner, arrive };
}

function getQuakeSearch(router: { state: { location: { search: unknown } } }): string | undefined {
  return (router.state.location.search as { quake?: string }).quake;
}

describe('live banner on phones', () => {
  beforeEach(async () => {
    await setViewport(390, 844);
  });

  afterEach(async () => {
    setHomeSheetOpen(false);
    vi.useRealTimers();
    vi.restoreAllMocks();
    await setViewport(1280, 800);
  });

  it('shows the newest noteworthy arrival under the header, never on the first load', async () => {
    const { screen, getAnnouncement, getBanner, arrive } = await renderBanner();
    expect(getAnnouncement()).toBe('');
    expect(getBanner()).toBeNull();

    await arrive(NOTEWORTHY, SMALL);

    await expect.poll(getBanner).not.toBeNull();
    await expect.element(screen.getByText('New earthquake · M4.7')).toBeVisible();
    await expect.element(screen.getByText('Eastern Xizang')).toBeVisible();
    await expect.element(screen.getByText('Just now · 10 km deep')).toBeVisible();
    const banner = getBanner() as HTMLElement;
    await Promise.all(banner.getAnimations().map(({ finished }) => finished));
    const rect = banner.getBoundingClientRect();
    expect({ top: rect.top, left: rect.left, width: rect.width }).toEqual({
      top: 92,
      left: 16,
      width: 358,
    });
    const style = getComputedStyle(banner);
    expect(style.borderTopColor).toBe('rgba(235, 89, 142, 0.7)');
    expect(style.borderTopWidth).toBe('1px');
    expect(style.borderRadius).toBe('6px');
    expect(style.padding).toBe('12px 14px');
    expect(style.backgroundColor).toBe('rgba(23, 26, 51, 0.6)');
    expect(style.backdropFilter).toBe('blur(24px)');
    for (const name of ['Fly to', 'Dismiss']) {
      const button = screen.getByRole('button', { name }).element().getBoundingClientRect();
      expect(Math.min(button.width, button.height)).toBeGreaterThanOrEqual(44);
    }
  });

  it('announces only the text of the arrival, once, not again when it shows after the sheet', async () => {
    const { announcer, getAnnouncement, getBanner, arrive } = await renderBanner();

    await arrive(NOTEWORTHY);
    await expect.poll(getAnnouncement).toBe(ANNOUNCEMENT);
    expect(announcer.querySelector('button')).toBeNull();
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(announcer, { childList: true, subtree: true, characterData: true });
    setHomeSheetOpen(true);
    await expect.poll(getBanner).toBeNull();
    setHomeSheetOpen(false);
    await expect.poll(getBanner).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    observer.disconnect();

    expect(mutations).toHaveLength(0);
    expect(getAnnouncement()).toBe(ANNOUNCEMENT);
  });

  it('stays empty for an arrival below M4.5 that nobody feels', async () => {
    const { getAnnouncement, getBanner, arrive } = await renderBanner();

    await arrive(SMALL);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(getBanner()).toBeNull();
    expect(getAnnouncement()).toBe('');
  });

  it('asks the globe to fly to the arrival from Fly to and dismisses itself', async () => {
    const { screen, getBanner, arrive } = await renderBanner();
    const onFlyTo = vi.fn<(earthquake: Earthquake) => void>();
    const unsubscribe = subscribeGlobeFlyTo(onFlyTo);

    await arrive(NOTEWORTHY);
    await screen.getByRole('button', { name: 'Fly to' }).click();
    unsubscribe();

    expect(onFlyTo).toHaveBeenCalledTimes(1);
    expect(onFlyTo.mock.calls[0][0]).toMatchObject({ source: 'emsc', id: 'strong' });
    await expect.poll(getBanner).toBeNull();
  });

  it.each(['Dismiss', 'Fly to'])(
    'moves focus to the home sheet handle when %s closes the focused banner',
    async (name) => {
      const { screen, getBanner, arrive } = await renderBanner();

      await arrive(NOTEWORTHY);
      await expect.poll(getBanner).not.toBeNull();
      const button = screen.getByRole('button', { name }).element() as HTMLElement;
      button.focus();
      button.click();

      await expect.poll(getBanner).toBeNull();
      expect(document.activeElement?.textContent).toBe('Sheet handle');
    },
  );

  it('dismisses from ✕', async () => {
    const { screen, getAnnouncement, getBanner, arrive } = await renderBanner();

    await arrive(NOTEWORTHY);
    await screen.getByRole('button', { name: 'Dismiss' }).click();

    await expect.poll(getBanner).toBeNull();
    expect(getAnnouncement()).toBe('');
  });

  it('hands the arrival from its body to the globe like a tap and dismisses itself', async () => {
    const { screen, router, getBanner, arrive } = await renderBanner();
    const onSelect = vi.fn<(earthquake: Earthquake) => void>();
    const unsubscribe = subscribeGlobeSelect(onSelect);

    await arrive(NOTEWORTHY);
    await screen.getByRole('button', { name: /New earthquake/ }).click();
    unsubscribe();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ source: 'emsc', id: 'strong' });
    expect(getQuakeSearch(router)).toBeUndefined();
    await expect.poll(getBanner).toBeNull();
  });

  it('opens the detail of the arrival through the URL when no globe is mounted', async () => {
    const { screen, router, arrive } = await renderBanner();

    await arrive(NOTEWORTHY);
    await screen.getByRole('button', { name: /New earthquake/ }).click();

    await expect.poll(() => getQuakeSearch(router)).toBe('emsc:strong');
  });

  it('dismisses itself after 15 s, but not while focus is inside it', async () => {
    const { screen, getBanner, arrive } = await renderBanner();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });

    await arrive(NOTEWORTHY);
    await expect.poll(getBanner).not.toBeNull();
    const flyTo = screen.getByRole('button', { name: 'Fly to' }).element() as HTMLElement;
    flyTo.focus();
    await vi.advanceTimersByTimeAsync(AUTO_DISMISS_MS);
    expect(getBanner()).not.toBeNull();
    flyTo.blur();
    await vi.advanceTimersByTimeAsync(AUTO_DISMISS_MS - 1);
    expect(getBanner()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);

    await expect.poll(getBanner).toBeNull();
  });

  it('hides while the home sheet is open or an Earthquake is selected', async () => {
    const { router, getBanner, arrive } = await renderBanner();

    await arrive(NOTEWORTHY);
    await expect.poll(getBanner).not.toBeNull();
    setHomeSheetOpen(true);
    await expect.poll(getBanner).toBeNull();
    setHomeSheetOpen(false);
    await expect.poll(getBanner).not.toBeNull();
    await router.navigate({ to: '/', search: { quake: 'emsc:old' } });

    await expect.poll(getBanner).toBeNull();
  });
});

describe('live banner on wider screens', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stays hidden at 768 px and wider', async () => {
    const { announcer, getAnnouncement, arrive } = await renderBanner();

    await arrive(NOTEWORTHY);

    await expect.poll(getAnnouncement).toBe(ANNOUNCEMENT);
    expect(getComputedStyle(announcer.parentElement as HTMLElement).display).toBe('none');
  });
});
