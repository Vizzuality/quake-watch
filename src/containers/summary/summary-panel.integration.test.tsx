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
import { Profiler } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import { SummaryPanel } from '@/containers/summary/summary-panel';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

const SELECTED_QUAKE = 'emsc:20261029_0000123';
const RANGE = {
  start: Date.parse('2026-10-26T00:00:00.000Z'),
  end: Date.parse('2026-11-02T00:00:00.000Z'),
};

function expectWithinPixel(actual: number | undefined, expected: number) {
  expect(Math.abs((actual ?? Number.NaN) - expected)).toBeLessThanOrEqual(1);
}

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let left = count;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function renderSummary(initialEntry = '/') {
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
  const commits = { count: 0 };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: () => (
      <main className="relative h-dvh">
        <Profiler id="summary" onRender={() => (commits.count += 1)}>
          <SummaryPanel />
        </Profiler>
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
  await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('3');
  playbackClock.setRange(RANGE);
  return { screen, router, commits };
}

describe('summary panel', () => {
  afterEach(async () => {
    playbackClock.setRange(null);
    await page.viewport(1280, 800);
  });

  it('shows the counts and Largest so far for the whole Interval when live', async () => {
    const { screen } = await renderSummary();

    await expect
      .element(screen.getByRole('heading', { level: 2, name: '3 earthquakes this week.' }))
      .toBeVisible();
    await expect.element(screen.getByText('earthquakes this week.')).toBeVisible();
    await expect
      .element(screen.getByRole('term').nth(0).getByText('Likely felt', { exact: true }))
      .toBeVisible();
    await expect.element(screen.getByRole('definition').nth(0)).toHaveTextContent('2');
    await expect
      .element(
        screen
          .getByRole('term')
          .nth(1)
          .getByText('Largest · Easter Island Region', { exact: true }),
      )
      .toBeVisible();
    await expect.element(screen.getByRole('definition').nth(1)).toHaveTextContent('6.4');
  });

  it('counts the list filtered at the playhead and returns to the total when live', async () => {
    const { screen } = await renderSummary();
    const count = screen.getByTestId('summary-count');

    playbackClock.seek(Date.parse('2026-10-27T12:00:00.000Z'));
    await expect.element(count).toHaveTextContent('1');
    await expect.element(screen.getByText('earthquake this week.')).toBeVisible();

    playbackClock.seek(Date.parse('2026-10-26T12:00:00.000Z'));
    await expect.element(count).toHaveTextContent('0');
    await expect.element(screen.getByText('Largest', { exact: true })).toBeVisible();
    await expect.element(screen.getByText('—')).toBeVisible();

    playbackClock.goLive();
    await expect.element(count).toHaveTextContent('3');
  });

  it('commits only when the shown count changes while the playhead moves', async () => {
    const { commits } = await renderSummary();
    playbackClock.seek(Date.parse('2026-10-31T00:00:00.000Z'));
    await waitFrames(2);
    const before = commits.count;

    playbackClock.play();
    await waitFrames(30);
    playbackClock.pause();

    expect(commits.count).toBe(before);
  });

  it.each([800, 900])('matches the D1 Summary geometry at 1440×%i', async (height) => {
    await page.viewport(1440, height);
    const { screen } = await renderSummary();
    const summary = screen.getByTestId('summary').element();
    const count = screen.getByTestId('summary-count').element();
    const stats = summary.querySelectorAll('dl > div');
    const label = summary.querySelector('dt > span > span');
    const rect = summary.getBoundingClientRect();

    expectWithinPixel(rect.left, 56);
    expectWithinPixel(rect.top, 143);
    expectWithinPixel(rect.width, 250);
    expectWithinPixel(count.getBoundingClientRect().top, 167);
    expectWithinPixel(stats[0]?.getBoundingClientRect().top, 313);
    expectWithinPixel(stats[1]?.getBoundingClientRect().top, 418);
    expectWithinPixel(rect.bottom, 524);
    expect(getComputedStyle(count).fontSize).toBe('52px');
    expect(getComputedStyle(count).fontWeight).toBe('300');
    expect(getComputedStyle(label as Element).fontSize).toBe('10px');
    expect(getComputedStyle(label as Element).color).toBe('rgb(160, 157, 193)');
  });

  it('explains each stat from an Info button next to its label', async () => {
    const { screen } = await renderSummary();
    const likelyFelt = screen.getByRole('button', { name: 'More about Likely felt' });
    const largest = screen.getByRole('button', {
      name: 'More about Largest · Easter Island Region',
    });

    await expect
      .element(likelyFelt)
      .toHaveAccessibleDescription(/estimate from magnitude and depth/);
    await expect.element(largest).toHaveAccessibleDescription(/strongest earthquake/);
    await userEvent.hover(likelyFelt);
    await expect.element(screen.getByRole('tooltip')).toBeVisible();
  });

  it('opens the largest Earthquake from the keyboard on desktop and takes focus back on close', async () => {
    const { screen, router } = await renderSummary();
    const open = screen.getByRole('button', { name: 'Open the largest earthquake' });

    await expect.element(open).toBeVisible();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await expect.element(open).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    await expect.poll(() => router.state.location.search.quake).toBe('emsc:a');
    await expect.poll(() => document.activeElement).toBe(document.body);
    await router.navigate({ to: '/', search: (prev) => ({ ...prev, quake: undefined }) });
    await expect.element(open).toHaveFocus();
  });

  it('hides when an Earthquake is selected and returns when it is cleared', async () => {
    const { screen, router } = await renderSummary(`/?quake=${SELECTED_QUAKE}`);
    const summary = screen.getByTestId('summary');

    await expect.element(summary).toHaveAttribute('aria-hidden', 'true');
    await expect.element(summary).toHaveStyle({ pointerEvents: 'none' });
    await expect.element(summary).not.toBeVisible();

    await router.navigate({ to: '/', search: (prev) => ({ ...prev, quake: undefined }) });

    await expect.element(summary).toBeVisible();
    await expect.element(summary).not.toHaveAttribute('aria-hidden', 'true');
  });
});
