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
import { page, userEvent } from 'vitest/browser';

import { Header } from '@/containers/header/header';
import { setLiveUpdatesPaused } from '@/lib/earthquakes/live-updates';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { overwriteGetLocale } from '@/paraglide/runtime';

const RANGE = {
  start: Date.parse('2026-10-26T00:00:00.000Z'),
  end: Date.parse('2026-11-02T00:00:00.000Z'),
};

async function renderHeader(initialEntry = '/') {
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: () => (
      <main className="relative h-dvh">
        <Header />
      </main>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  await router.load();
  const screen = await render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { screen, router };
}

function getRect(element: Element): DOMRect {
  return element.getBoundingClientRect();
}

describe('header', () => {
  afterEach(async () => {
    playbackClock.setRange(null);
    setLiveUpdatesPaused(false);
    overwriteGetLocale(() => 'en');
    await page.viewport(1280, 800);
  });

  it('places the wordmark and About as D1 and the status at the top right at 1440×900', async () => {
    await page.viewport(1440, 900);
    const { screen } = await renderHeader('/?source=usgs');
    const about = screen.getByRole('button', { name: 'About' }).element();
    const wordmark = screen.container.querySelector('header svg') as SVGElement;
    const status = screen.getByText('Live · USGS').element();
    const languages = screen.getByRole('navigation', { name: 'Language' }).element();

    expect(getRect(wordmark).left).toBe(56);
    expect(getRect(wordmark).top).toBeCloseTo(60.5, 0);
    expect(getRect(wordmark).width).toBe(159);
    expect(getRect(about).left).toBe(235);
    expect(getRect(about).top).toBeCloseTo(58, 0);
    expect(getRect(status).top).toBe(56);
    expect(getRect(status).height).toBe(12);
    expect(getRect(languages).right).toBe(1369);
    expect(getRect(status).right + 24).toBe(getRect(languages).left);
    const style = getComputedStyle(status);
    expect(style.fontSize).toBe('10px');
    expect(style.fontWeight).toBe('700');
    expect(style.letterSpacing).toBe('1.5px');
  });

  it('shows the source from the URL and the Live dot only while live', async () => {
    const { screen } = await renderHeader();
    const status = screen.getByRole('status');

    await expect.element(status).toHaveTextContent('Live · EMSC');
    expect(status.element().querySelector('[data-live-dot]')).not.toBeNull();

    playbackClock.setRange(RANGE);
    playbackClock.seek(Date.parse('2026-10-28T00:00:00.000Z'));

    await expect.poll(() => status.element().textContent).toBe('EMSC');
    expect(status.element().querySelector('[data-live-dot]')).toBeNull();

    playbackClock.goLive();
    await expect.element(status).toHaveTextContent('Live · EMSC');
  });

  it('pauses and resumes live updates at 24h from a toggle beside the status', async () => {
    const { screen } = await renderHeader('/?interval=24h');
    const status = screen.getByRole('status');
    const toggle = screen.getByRole('button', { name: 'Pause live updates' });

    await expect.element(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.element(status).toHaveTextContent('Live · EMSC');

    await toggle.click();

    await expect.element(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.element(status).toHaveTextContent('Paused · EMSC');
    expect(status.element().querySelector('[data-live-dot]')).toBeNull();

    toggle.element().focus();
    await userEvent.keyboard('{Enter}');

    await expect.element(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.element(status).toHaveTextContent('Live · EMSC');
  });

  it.each(['/', '/?interval=3d'])('has no live updates toggle for %s', async (initialEntry) => {
    const { screen } = await renderHeader(initialEntry);
    await expect.element(screen.getByRole('status')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pause live updates' }).query()).toBeNull();
  });

  it.each([
    [390, 844],
    [320, 640],
  ])(
    'gives the live updates toggle a 44 px hit area clear of About at %i×%i',
    async (width, height) => {
      await page.viewport(width, height);
      const { screen } = await renderHeader('/?interval=24h');
      const toggle = screen.getByRole('button', { name: 'Pause live updates' }).element();
      const about = getRect(screen.getByRole('button', { name: 'About' }).element());
      const rect = getRect(toggle);
      const before = getComputedStyle(toggle, '::before');
      const hit = {
        left: rect.left + parseFloat(before.left),
        right: rect.right - parseFloat(before.right),
        top: rect.top + parseFloat(before.top),
        bottom: rect.bottom - parseFloat(before.bottom),
      };

      expect(hit.right - hit.left).toBeGreaterThanOrEqual(44);
      expect(hit.bottom - hit.top).toBeGreaterThanOrEqual(44);
      expect(hit.right).toBeLessThanOrEqual(about.left);
      expect(about.right).toBe(width - 20);
      expect(document.documentElement.scrollWidth).toBe(width);
    },
  );

  it('lines the wordmark and About up with the D2 detail row and drops the top-right status', async () => {
    await page.viewport(1440, 900);
    const { screen } = await renderHeader('/?quake=usgs:us7000abcd');
    const about = screen.getByRole('button', { name: 'About' }).element();
    const wordmark = screen.container.querySelector('header svg') as SVGElement;

    expect(getRect(wordmark).left).toBe(56);
    expect(getRect(wordmark).top).toBe(63);
    expect(getRect(about).left).toBe(243);
    expect(getRect(about).top + getRect(about).height / 2).toBeCloseTo(71, 0);
    expect(screen.container.querySelector('[role="status"]')).toBeNull();
    expect(screen.container.querySelector('nav')).toBeNull();
  });

  it.each([
    [390, 844],
    [767, 900],
  ])(
    'hides the wordmark and About row in the phone detail view, where the top bar takes over, at %i×%i',
    async (width, height) => {
      await page.viewport(width, height);
      const { screen } = await renderHeader('/?quake=usgs:us7000abcd');

      const wordmark = screen.container.querySelector('header svg') as SVGElement;
      await expect.poll(() => getRect(wordmark).width).toBe(0);
      expect(screen.getByRole('button', { name: 'About' }).query()).toBeNull();
    },
  );

  it.each([
    [390, 844, 'en'],
    [360, 740, 'pt'],
    [320, 640, 'es'],
  ] as const)(
    'puts the wordmark, Live · source and About on one row at %i×%i in %s',
    async (width, height, locale) => {
      overwriteGetLocale(() => locale);
      await page.viewport(width, height);
      const { screen } = await renderHeader('/?source=usgs');
      const wordmark = screen.container.querySelector('header svg') as SVGElement;
      const status = screen.getByRole('status').element();
      const about = screen.container.querySelector('header button') as HTMLElement;
      const centre = (rect: DOMRect) => rect.top + rect.height / 2;

      expect(getRect(wordmark).left).toBe(20);
      expect(getRect(wordmark).width).toBe(124);
      expect(centre(getRect(wordmark))).toBeCloseTo(70, 0);
      expect(centre(getRect(status))).toBeCloseTo(70, 0);
      expect(centre(getRect(about))).toBeCloseTo(70, 0);
      expect(getRect(status).left).toBeGreaterThan(getRect(wordmark).right);
      expect(getRect(about).left).toBeGreaterThanOrEqual(getRect(status).right + 16);
      expect(getRect(about).right).toBe(width - 20);
      expect(getRect(about).height).toBeGreaterThanOrEqual(44);
      expect(status.scrollWidth).toBeLessThanOrEqual(status.clientWidth);
      expect(screen.getByRole('navigation').query()).toBeNull();
    },
  );
});
