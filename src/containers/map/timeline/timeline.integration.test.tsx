import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { PlaybackProvider } from '../playback-context';
import { Timeline } from './timeline';

function TimelineUnderTest() {
  return (
    <PlaybackProvider>
      <Timeline />
    </PlaybackProvider>
  );
}

function stubEarthquakes(times: string[]) {
  return stubFetch([
    {
      match: (url) => url.hostname === 'www.seismicportal.eu',
      respond: () =>
        times.length === 0
          ? new Response(null, { status: 204 })
          : Response.json(
              getFeatureCollection(
                times.map((time, index) => getEmscFeature({ id: `e${index}`, time })),
              ),
            ),
    },
  ]);
}

const THREE_EARTHQUAKES = ['2026-08-13T10:00:00Z', '2026-08-13T20:00:00Z', '2026-08-14T08:00:00Z'];

const NOW = '2026-08-14T12:00:00.000Z';

describe('Timeline', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('draws one bar per daily bin with a tooltip per bar', async () => {
    stubEarthquakes(THREE_EARTHQUAKES);
    const { screen } = await renderWithRouter(TimelineUnderTest, '/?period=7d');
    const histogram = screen.getByRole('slider', { name: /Earthquakes over time/ });
    await expect.poll(() => document.querySelectorAll('[data-bar]').length).toBe(2);
    await userEvent.hover(histogram, { position: { x: 10, y: 20 } });
    await expect
      .poll(() => screen.getByTestId('timeline-bar-tooltip').query()?.textContent)
      .toBe('Aug 13 · 2 earthquakes');
  });

  it('toggles playback with Space from inside the timeline', async () => {
    stubEarthquakes(THREE_EARTHQUAKES);
    const { screen } = await renderWithRouter(TimelineUnderTest, '/?period=7d');
    const play = screen.getByRole('button', { name: 'Play' });
    await expect.element(play).toBeEnabled();
    screen.getByRole('slider', { name: 'Playback time' }).element().focus();
    await userEvent.keyboard(' ');
    await expect.element(play).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard(' ');
    await expect.element(play).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles playback with Space from the histogram', async () => {
    stubEarthquakes(THREE_EARTHQUAKES);
    const { screen } = await renderWithRouter(TimelineUnderTest, '/?period=7d');
    const play = screen.getByRole('button', { name: 'Play' });
    await expect.element(play).toBeEnabled();
    screen.getByRole('slider', { name: 'Earthquakes over time' }).element().focus();
    await userEvent.keyboard(' ');
    await expect.element(play).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes the window to the URL and hides the selector for a 24h period', async () => {
    stubEarthquakes(THREE_EARTHQUAKES);
    const week = await renderWithRouter(TimelineUnderTest, '/?period=7d');
    await week.screen.getByRole('button', { name: 'Last 7 days' }).click();
    await expect.poll(() => week.router.state.location.search).toMatchObject({ window: '7d' });
    await week.screen.unmount();

    const day = await renderWithRouter(TimelineUnderTest);
    await expect.element(day.screen.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect
      .element(day.screen.getByRole('group', { name: 'Playback window' }))
      .not.toBeInTheDocument();
  });

  it('writes t on slider release without refetching earthquakes', async () => {
    const fetchMock = stubEarthquakes(THREE_EARTHQUAKES);
    const { screen, router } = await renderWithRouter(TimelineUnderTest, '/?period=7d');
    await expect.element(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(router.state.location.search).not.toHaveProperty('t');
    screen.getByRole('slider', { name: 'Playback time' }).element().focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect
      .poll(() => (router.state.location.search as { t?: string }).t)
      .toMatch(/^2026-08-14T11:\d{2}:00\.000Z$/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('moves the window to the period edges with Home and End', async () => {
    stubEarthquakes(THREE_EARTHQUAKES);
    const { screen, router } = await renderWithRouter(TimelineUnderTest, '/?period=7d');
    const histogram = screen.getByRole('slider', { name: 'Earthquakes over time' });
    await expect.element(histogram).toHaveAccessibleDescription(/Home and End/);
    histogram.element().focus();
    await userEvent.keyboard('{Home}');
    await expect
      .poll(() => (router.state.location.search as { t?: string }).t)
      .toBe('2026-08-13T10:00:00.000Z');
    await userEvent.keyboard('{End}');
    await expect.poll(() => (router.state.location.search as { t?: string }).t).toBe(NOW);
  });

  it('keeps the range end while the next period is pending and moves it once loaded', async () => {
    const body = getFeatureCollection(
      THREE_EARTHQUAKES.map((time, index) => getEmscFeature({ id: `e${index}`, time })),
    );
    const pending = Promise.withResolvers<Response>();
    let calls = 0;
    stubFetch([
      {
        match: (url) => url.hostname === 'www.seismicportal.eu',
        respond: () => {
          calls += 1;
          return calls === 1 ? Response.json(body) : pending.promise;
        },
      },
    ]);
    const { screen, router } = await renderWithRouter(TimelineUnderTest, '/?period=7d');
    const histogram = screen.getByRole('slider', { name: 'Earthquakes over time' });
    const playback = screen.getByRole('slider', { name: 'Playback time' });
    await expect.element(histogram).toHaveAttribute('aria-valuemax', String(Date.parse(NOW)));

    const later = '2026-08-14T13:00:00.000Z';
    vi.setSystemTime(new Date(later));
    await router.navigate({ to: '/', search: { period: '30d' } });
    await expect.poll(() => calls).toBe(2);
    await expect.element(histogram).toHaveAttribute('aria-valuemax', String(Date.parse(NOW)));
    await expect.element(playback).toHaveAttribute('max', String(Date.parse(NOW)));

    pending.resolve(Response.json(body));
    await expect.element(histogram).toHaveAttribute('aria-valuemax', String(Date.parse(later)));
    await expect.element(playback).toHaveAttribute('max', String(Date.parse(later)));
  });

  it('leaves the error to the header and keeps play disabled when the source fails', async () => {
    stubFetch([
      {
        match: (url) => url.hostname === 'www.seismicportal.eu',
        respond: () => new Response(null, { status: 500 }),
      },
    ]);
    const { screen } = await renderWithRouter(TimelineUnderTest);
    await expect.element(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    expect(screen.getByText('No earthquakes to play').query()).toBeNull();
    expect(document.querySelectorAll('[data-bar]')).toHaveLength(0);
  });

  it('shows an empty state without playback controls when there are no earthquakes', async () => {
    stubEarthquakes([]);
    const { screen } = await renderWithRouter(TimelineUnderTest);
    await expect.element(screen.getByText('No earthquakes to play')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole('slider', { name: 'Playback time' }))
      .not.toBeInTheDocument();
  });
});
