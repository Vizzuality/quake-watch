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
import { page } from 'vitest/browser';

import { Header } from '@/containers/header/header';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';

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
  const screen = await render(<RouterProvider router={router} />);
  return { screen, router };
}

function getRect(element: Element): DOMRect {
  return element.getBoundingClientRect();
}

describe('header', () => {
  afterEach(async () => {
    playbackClock.setRange(null);
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
});
