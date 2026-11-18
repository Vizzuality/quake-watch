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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { Timeline } from '@/containers/timeline/timeline';
import { getDepthColor } from '@/lib/earthquakes/depth-color';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { TIME_RING_LOOK, getRingAngle, getRingPoint } from '@/lib/earthquakes/time-ring';
import { getGlobeFrame } from '@/lib/globe/frame';
import { overwriteGetLocale } from '@/paraglide/runtime';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

const WIDTH = 1280;
const HEIGHT = 800;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-11-02T00:00:00.000Z');
const START = NOW - 7 * DAY;
const STEP = (7 * DAY) / 48;

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

async function renderTimeline() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(Element.prototype, 'setPointerCapture').mockImplementation(() => {});
  stubFetch([
    {
      match: () => true,
      respond: () =>
        Response.json(
          getFeatureCollection([
            getEmscFeature({ id: 'a', time: '2026-10-28T10:00:00.000Z', mag: 6.2 }),
            getEmscFeature({ id: 'b', time: '2026-10-30T10:00:00.000Z', mag: 3 }),
          ]),
        ),
    },
  ]);
  const commits = { count: 0 };
  const wheels = { count: 0 };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: () => (
      <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
        <div
          data-testid="below"
          style={{ position: 'absolute', inset: 0 }}
          onWheel={() => (wheels.count += 1)}
        />
        <Profiler id="timeline" onRender={() => (commits.count += 1)}>
          <Timeline />
        </Profiler>
      </div>
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
  const slider = screen.getByRole('slider');
  await expect.element(slider).toBeInTheDocument();
  vi.useRealTimers();

  function pointAt(fraction: number) {
    const frame = getGlobeFrame(WIDTH, HEIGHT);
    const rect = screen.container.querySelector('svg')?.getBoundingClientRect();
    const point = getRingPoint(getRingAngle(fraction), (TIME_RING_LOOK.radius + 20) * frame.scale);
    return {
      clientX: (rect?.left ?? 0) + frame.cx + point.x,
      clientY: (rect?.top ?? 0) + frame.cy + point.y,
    };
  }

  function pointer(type: string, fraction: number) {
    slider
      .element()
      .dispatchEvent(new PointerEvent(type, { ...pointAt(fraction), pointerId: 1, bubbles: true }));
  }

  function wheel(fraction: number): WheelEvent {
    const event = new WheelEvent('wheel', {
      ...pointAt(fraction),
      deltaY: -200,
      bubbles: true,
      cancelable: true,
    });
    slider.element().dispatchEvent(event);
    return event;
  }

  function getNowClassName(): string {
    const now = [...screen.container.querySelectorAll('text')].find(
      (text) => text.textContent === 'Now',
    );
    return now?.getAttribute('class') ?? '';
  }

  return { screen, router, slider, commits, wheels, pointer, wheel, getNowClassName };
}

describe('timeline', () => {
  afterEach(() => {
    playbackClock.setRange(null);
    vi.useRealTimers();
    vi.restoreAllMocks();
    overwriteGetLocale(() => 'en');
  });

  it('starts at the end of the interval without autoplay', async () => {
    const { screen, slider } = await renderTimeline();

    await expect.element(screen.getByRole('slider', { name: 'Timeline' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect.element(slider).toHaveAttribute('aria-valuenow', String(NOW));
    await expect.element(slider).toHaveAttribute('aria-valuetext', 'Mon 02.11 · 00:00 UTC');
    await expect.element(screen.getByText('Mon 02.11 · 00:00 UTC')).toBeVisible();
    await expect.element(screen.getByText('1 day ≈ 7 s · drag the ring to scrub')).toBeVisible();
    await waitFrames(10);
    expect(playbackClock.getSnapshot()).toMatchObject({ isPlaying: false, playhead: null });
  });

  it('moves the playhead to x% of the interval on a click at x% of the ring', async () => {
    const { slider, pointer, router } = await renderTimeline();
    const href = router.state.location.href;

    pointer('pointerdown', 0.25);
    pointer('pointerup', 0.25);

    expect(Math.abs((playbackClock.getPlayhead() ?? 0) - (START + 0.25 * 7 * DAY))).toBeLessThan(
      60_000,
    );
    pointer('pointerdown', 0.6);
    pointer('pointermove', 0.75);
    pointer('pointerup', 0.75);
    expect(Math.abs((playbackClock.getPlayhead() ?? 0) - (START + 0.75 * 7 * DAY))).toBeLessThan(
      60_000,
    );
    await expect
      .element(slider)
      .toHaveAttribute('aria-valuenow', String(playbackClock.getPlayhead()));
    expect(router.state.location.href).toBe(href);
  });

  it('scrubs with the arrow, Home and End keys', async () => {
    const { slider, getNowClassName } = await renderTimeline();

    expect(getNowClassName()).toContain('fill-accent');
    (slider.element() as SVGElement).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(slider).toHaveAttribute('aria-valuenow', String(NOW - STEP));
    await userEvent.keyboard('{Home}');
    await expect.element(slider).toHaveAttribute('aria-valuenow', String(START));
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(slider).toHaveAttribute('aria-valuenow', String(START + STEP));
    expect(getNowClassName()).toContain('fill-foreground');
    await userEvent.keyboard('{End}');
    await expect.element(slider).toHaveAttribute('aria-valuenow', String(NOW));
    expect(playbackClock.getSnapshot()).toMatchObject({ isPlaying: false, playhead: null });
    await expect.poll(getNowClassName).toContain('fill-accent');
  });

  it('forwards a wheel over the ring to what lies under it', async () => {
    const { wheel, wheels } = await renderTimeline();

    wheel(0.3);

    expect(wheels.count).toBe(1);
  });

  it('plays from the start at the end, pauses, and does it from the keyboard', async () => {
    const { screen } = await renderTimeline();
    const play = screen.getByRole('button', { name: 'Play' });

    (play.element() as HTMLButtonElement).focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
    const startedAt = playbackClock.getPlayhead() ?? 0;
    expect(startedAt - START).toBeLessThan(STEP);
    await userEvent.keyboard(' ');
    await expect.element(screen.getByRole('button', { name: 'Play' })).toBeVisible();
    expect(playbackClock.getSnapshot().isPlaying).toBe(false);
  });

  it('commits nothing to React while the playhead moves', async () => {
    const { screen, commits } = await renderTimeline();

    await screen.getByRole('button', { name: 'Play' }).click();
    await expect.element(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
    await waitFrames(2);
    const before = { commits: commits.count, playhead: playbackClock.getPlayhead() ?? 0 };
    const time = screen.container.querySelector('p')?.textContent;
    await waitFrames(60);

    expect(commits.count).toBe(before.commits);
    expect(playbackClock.getPlayhead() ?? 0).toBeGreaterThan(before.playhead);
    expect(screen.container.querySelector('p')?.textContent).not.toBe(time);
  });

  it('plays the whole interval in 48 s and returns to now', async () => {
    const { screen } = await renderTimeline();
    let now = performance.now();
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    await screen.getByRole('button', { name: 'Play' }).click();
    now += 47_000;
    await waitFrames(2);
    expect(playbackClock.getSnapshot().isPlaying).toBe(true);
    expect(playbackClock.getPlayhead() ?? 0).toBeCloseTo(START + (47 / 48) * 7 * DAY, -3);
    now += 1000;
    await waitFrames(2);

    expect(playbackClock.getSnapshot()).toMatchObject({ isPlaying: false, playhead: null });
    await expect.element(screen.getByRole('button', { name: 'Play' })).toBeVisible();
  });

  it('shows the largest recent Earthquake next to the paused playhead', async () => {
    const { screen, slider } = await renderTimeline();

    (slider.element() as SVGElement).focus();
    playbackClock.seek(Date.parse('2026-10-28T11:00:00.000Z'));

    await expect.element(screen.getByText('Wed 28.10 · 11:00')).toBeInTheDocument();
    await expect.element(screen.getByText('M6.2 · Southern Spain')).toBeInTheDocument();
  });

  it('lights the bar of an Earthquake in its depth colour while its wave is live', async () => {
    const { screen } = await renderTimeline();
    const active = screen.getByTestId('time-ring-active').element();

    playbackClock.seek(Date.parse('2026-10-28T11:00:00.000Z'));
    await waitFrames(2);

    const bars = active.querySelectorAll('path');
    expect(bars).toHaveLength(1);
    expect(bars[0].getAttribute('stroke')).toBe(getDepthColor(2.1));
    expect(bars[0].getAttribute('stroke-opacity')).toBe('0.95');
    expect(bars[0].getAttribute('stroke-width')).toBe('1.6');

    playbackClock.seek(Date.parse('2026-10-29T12:00:00.000Z'));
    await waitFrames(2);

    expect(active.querySelectorAll('path')).toHaveLength(0);
  });

  it('speaks Spanish', async () => {
    overwriteGetLocale(() => 'es');
    const { screen } = await renderTimeline();

    await expect.element(screen.getByRole('button', { name: 'Reproducir' })).toBeVisible();
    await expect.element(screen.getByRole('slider', { name: 'Línea de tiempo' })).toBeVisible();
    await expect
      .element(screen.getByText('1 día ≈ 7 s · arrastra el anillo para moverte en el tiempo'))
      .toBeVisible();
  });

  it('hides the ring and the controls and goes live while an Earthquake is selected', async () => {
    const { screen, router } = await renderTimeline();
    await screen.getByRole('button', { name: 'Play' }).click();
    expect(playbackClock.getSnapshot().isPlaying).toBe(true);

    await router.navigate({ to: '/', search: { quake: 'emsc:a' } });

    await expect
      .poll(() => playbackClock.getSnapshot())
      .toMatchObject({ isPlaying: false, playhead: null });

    await expect.element(screen.getByRole('slider')).not.toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: 'Play' })).not.toBeInTheDocument();
  });
});
