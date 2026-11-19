import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp, userEvent } from 'vitest/browser';

import EarthquakePanel from '@/containers/earthquake-panel/earthquake-panel';
import { listenForTooltipEscape } from '@/containers/globe/use-hovered-quake';
import { subscribeWaveReplay } from '@/containers/globe/wave-replay';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { getPhoneLayout } from '@/lib/layout/phone';
import { getDetailSheetOpenTop } from '@/lib/layout/phone-detail';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { usgsPanamaDetail } from '@/test/fixtures/usgs-detail';
import { setViewport } from '@/test/set-viewport';
import { stubFetch } from '@/test/stub-fetch';

const EARLY_ID = '20261101_0000001';
const LATE_ID = '20261102_0000002';
const LIST = [
  getEmscFeature({ id: LATE_ID, time: '2026-11-02T10:00:00Z', region: 'NEAR COAST OF PERU' }),
  getEmscFeature({ id: EARLY_ID, time: '2026-11-01T10:00:00Z', region: 'SOUTHERN SPAIN' }),
];

function TestPage() {
  const { quake } = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });

  function open() {
    void navigate({ search: (prev) => ({ ...prev, quake: `emsc:${EARLY_ID}` }) });
  }

  return (
    <>
      <button type="button" onClick={open}>
        Open
      </button>
      {quake !== undefined && <EarthquakePanel quake={quake} />}
    </>
  );
}

const SEQUENCE = [
  getEmscFeature({ id: 'main', mag: 6.2, time: '2026-10-29T21:48:00Z' }),
  getEmscFeature({ id: 'fore', mag: 5.1, time: '2026-10-29T18:00:00Z', lat: 37.2 }),
  getEmscFeature({ id: 'after', mag: 4.4, time: '2026-10-30T02:00:00Z', lon: -3.5 }),
  getEmscFeature({ id: 'small', mag: 3.2, time: '2026-10-30T08:00:00Z', lat: 37.05 }),
];

type RenderOptions = {
  emscDetailStatuses?: number[];
  listGate?: Promise<void>;
  list?: unknown[];
};

async function renderPanel(
  initialEntry: string,
  { emscDetailStatuses = [], listGate, list = LIST }: RenderOptions = {},
) {
  const statuses = [...emscDetailStatuses];
  stubFetch([
    {
      match: (url) => url.hostname === 'earthquake.usgs.gov' && url.searchParams.has('eventid'),
      respond: () => Response.json(usgsPanamaDetail),
    },
    {
      match: (url) => url.hostname === 'www.seismicportal.eu' && url.searchParams.has('eventid'),
      respond: () => new Response(null, { status: statuses.shift() ?? 204 }),
    },
    {
      match: (url) => url.hostname === 'www.seismicportal.eu',
      respond: async () => {
        await listGate;
        return Response.json(getFeatureCollection(list));
      },
    },
  ]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: TestPage,
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
  return { screen, router };
}

describe('earthquake panel', () => {
  it('opens an EMSC Earthquake from the URL and moves focus to its heading', async () => {
    const { screen } = await renderPanel(`/?quake=emsc:${EARLY_ID}`);

    const region = screen.getByRole('region', {
      name: 'Magnitude 5.2 Earthquake, Southern Spain',
    });
    await expect.element(region).toBeVisible();
    await expect
      .element(screen.getByRole('heading', { name: 'Magnitude 5.2 Earthquake, Southern Spain' }))
      .toHaveFocus();
    await expect.element(screen.getByText('Event 1 / 2')).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: /EMSC/ }))
      .toHaveAttribute('href', `https://www.seismicportal.eu/eventdetails.html?unid=${EARLY_ID}`);
  });

  it('opens a USGS Earthquake outside the list from the URL with its catalogue link', async () => {
    const { screen } = await renderPanel('/?quake=usgs:us6000u18k');

    await expect
      .element(
        screen.getByRole('region', {
          name: 'Magnitude 7.7 Earthquake, 12 km WSW of Pitaloza Arriba, Panama',
        }),
      )
      .toBeVisible();
    await expect.element(screen.getByText('1,805')).toBeVisible();
    const link = screen.getByRole('link', { name: /USGS/ });
    await expect
      .element(link)
      .toHaveAttribute('href', 'https://earthquake.usgs.gov/earthquakes/eventpage/us6000u18k');
    await expect.element(link).toHaveAttribute('target', '_blank');
    await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect.element(screen.getByRole('button', { name: 'Next Earthquake' })).toBeDisabled();
  });

  it('steps through Earthquakes in time order and disables the ends', async () => {
    const { screen, router } = await renderPanel(`/?quake=emsc:${EARLY_ID}`);
    const previous = screen.getByRole('button', { name: 'Previous Earthquake' });
    const next = screen.getByRole('button', { name: 'Next Earthquake' });

    await expect.element(previous).toBeDisabled();
    await expect.element(next).toBeEnabled();
    await next.click();

    await expect.poll(() => router.state.location.search.quake).toBe(`emsc:${LATE_ID}`);
    await expect.element(screen.getByText('Event 2 / 2')).toBeVisible();
    await expect.element(next).toBeDisabled();
    await expect.element(previous).toBeEnabled();
  });

  it('closes on Escape and returns focus to where it was before opening', async () => {
    const { screen, router } = await renderPanel('/');
    const opener = screen.getByRole('button', { name: 'Open' });
    await opener.click();
    await expect.element(screen.getByRole('heading', { name: /Southern Spain/ })).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    await expect.poll(() => router.state.location.search.quake).toBeUndefined();
    await expect.element(screen.getByRole('region')).not.toBeInTheDocument();
    await expect.element(opener).toHaveFocus();
  });

  it('closes from the back button and returns to the Map view', async () => {
    const { screen, router } = await renderPanel(`/?quake=emsc:${LATE_ID}&view=section`);

    await screen.getByRole('button', { name: 'Back to globe' }).click();

    await expect.poll(() => router.state.location.search.quake).toBeUndefined();
    expect(router.state.location.search.view).not.toBe('section');
  });

  it('says inline that an unknown Earthquake was not found', async () => {
    const { screen } = await renderPanel('/?quake=emsc:20990101_0000000');

    const heading = screen.getByRole('heading', { name: 'Earthquake not found' });
    await expect.element(heading).toBeVisible();
    await expect.element(heading).toHaveFocus();
    await expect
      .element(screen.getByRole('region', { name: 'Earthquake not found' }))
      .toBeVisible();
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
  });

  it('waits for the list before saying an Earthquake was not found', async () => {
    let releaseList = () => {};
    const listGate = new Promise<void>((resolve) => {
      releaseList = resolve;
    });
    const { screen, router } = await renderPanel('/?quake=emsc:20990101_0000000', { listGate });

    await expect.poll(() => router.state.status).toBe('idle');
    await expect
      .element(screen.getByRole('heading', { name: 'Loading Earthquake' }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole('heading', { name: 'Earthquake not found' }))
      .not.toBeInTheDocument();

    releaseList();

    await expect
      .element(screen.getByRole('heading', { name: 'Earthquake not found' }))
      .toBeVisible();
  });

  it('shows a failed detail inline with a retry instead of not found', async () => {
    const { screen } = await renderPanel('/?quake=emsc:20990101_0000000', {
      emscDetailStatuses: [500],
    });

    const alert = screen.getByRole('alert');
    await expect.element(alert).toBeVisible();
    await expect.element(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect
      .element(screen.getByRole('heading', { name: "Couldn't load this Earthquake" }))
      .toHaveFocus();
    await expect
      .element(screen.getByRole('heading', { name: 'Earthquake not found' }))
      .not.toBeInTheDocument();

    await screen.getByRole('button', { name: 'Try again' }).click();

    await expect
      .element(screen.getByRole('heading', { name: 'Earthquake not found' }))
      .toHaveFocus();
    await expect.element(alert).not.toBeInTheDocument();
  });

  it('moves focus to the other arrow when the focused one reaches an end', async () => {
    const { screen } = await renderPanel(`/?quake=emsc:${EARLY_ID}`);
    const next = screen.getByRole('button', { name: 'Next Earthquake' });

    await next.click();

    await expect.element(next).toBeDisabled();
    await expect.element(screen.getByRole('button', { name: 'Previous Earthquake' })).toHaveFocus();

    await screen.getByRole('button', { name: 'Previous Earthquake' }).click();

    await expect.element(next).toHaveFocus();
  });

  it('leaves the panel open when Escape dismisses an open tooltip first', async () => {
    const { screen, router } = await renderPanel(`/?quake=emsc:${EARLY_ID}`);
    await expect.element(screen.getByRole('region')).toBeVisible();
    const hideTooltip = vi.fn<() => void>();
    const stopListening = listenForTooltipEscape(hideTooltip);

    await userEvent.keyboard('{Escape}');

    expect(hideTooltip).toHaveBeenCalledOnce();
    expect(router.state.location.search.quake).toBe(`emsc:${EARLY_ID}`);
    await expect.element(screen.getByRole('region')).toBeVisible();

    stopListening();
    await userEvent.keyboard('{Escape}');

    await expect.poll(() => router.state.location.search.quake).toBeUndefined();
    expect(hideTooltip).toHaveBeenCalledOnce();
  });

  it('replays the wave of the shown Earthquake by its raw id', async () => {
    const { screen } = await renderPanel(`/?quake=emsc:${EARLY_ID}`);
    const listener = vi.fn<(id: string) => void>();
    const unsubscribe = subscribeWaveReplay(listener);

    await screen.getByRole('button', { name: 'Replay wave' }).click();

    expect(listener).toHaveBeenCalledExactlyOnceWith(EARLY_ID);
    unsubscribe();
  });

  it('lists at most three related Earthquakes, always including the selected one', async () => {
    const { screen } = await renderPanel('/?quake=emsc:small', { list: SEQUENCE });

    await expect.element(screen.getByText('Followed an M6.2 nearby on Thu 29.10.')).toBeVisible();
    const rows = screen.getByRole('listitem');
    await expect.poll(() => rows.elements().length).toBe(3);
    await expect.element(screen.getByRole('button', { name: /M6\.2 .* Largest/ })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: /M5\.1 .* Before/ })).toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: /M3\.2 .* Selected/ }))
      .toHaveAttribute('aria-current', 'true');
    await expect.element(screen.getByRole('button', { name: /M4\.4/ })).not.toBeInTheDocument();
  });

  it('selects a related Earthquake when its row is clicked', async () => {
    const { screen, router } = await renderPanel('/?quake=emsc:small', { list: SEQUENCE });

    await screen.getByRole('button', { name: /M6\.2 .* Largest/ }).click();

    await expect.poll(() => router.state.location.search.quake).toBe('emsc:main');
    await expect
      .element(screen.getByText('The largest of a group: 3 struck nearby this week.'))
      .toBeVisible();
  });

  it('disables Replay for an Earthquake that is not on the globe', async () => {
    const { screen } = await renderPanel('/?quake=usgs:us6000u18k');

    await expect.element(screen.getByRole('button', { name: 'Replay wave' })).toBeDisabled();
  });

  it('explains each data label from an Info button and Escape closes the tip before the panel', async () => {
    const { screen, router } = await renderPanel('/?quake=usgs:us6000u18k');
    await expect.element(screen.getByText('1,805')).toBeVisible();

    for (const [name, info] of [
      ['Magnitude', /size of the earthquake/],
      ['Depth', /rupture began/],
      ['Likely felt', /from the epicentre/],
      ['Felt reports', /Did You Feel It/],
      ['Type', /measure the magnitude/],
      ['Source', /official event page/],
    ] as const) {
      await expect
        .element(screen.getByRole('button', { name: `More about ${name}` }))
        .toHaveAccessibleDescription(info);
    }

    screen.getByRole('button', { name: 'More about Depth' }).element().focus();
    await expect.element(screen.getByRole('tooltip')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByText(/rupture began/)).not.toBeVisible();
    expect(router.state.location.search.quake).toBe('usgs:us6000u18k');
  });

  it('drops the depth class caption and starts the depth bar in a fixed column as D2', async () => {
    const { screen } = await renderPanel('/?quake=usgs:us6000u18k');
    await expect.element(screen.getByText('1,805')).toBeVisible();

    expect(screen.container.textContent).not.toContain('Shallow');
    const bar = screen.getByTestId('depth-scale').element().getBoundingClientRect();
    const column = screen.getByTestId('depth-row').element().getBoundingClientRect();
    expect(bar.left - column.left).toBe(110);
    expect(bar.width).toBe(310);
  });
});

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function getRect(element: Element): Rect {
  const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
  return { left, top, right, bottom, width, height };
}

function getHitButton(x: number, y: number): Element | null {
  return document.elementFromPoint(x, y)?.closest('button, label') ?? null;
}

function getHitRect(element: Element): Rect {
  const rect = getRect(element);
  const before = getComputedStyle(element, '::before');
  if (before.display === 'none' || before.content === 'none') return rect;
  const style = getComputedStyle(element);
  const left = rect.left + parseFloat(style.borderLeftWidth) + parseFloat(before.left);
  const right = rect.right - parseFloat(style.borderRightWidth) - parseFloat(before.right);
  const top = rect.top + parseFloat(style.borderTopWidth) + parseFloat(before.top);
  const bottom = rect.bottom - parseFloat(style.borderBottomWidth) - parseFloat(before.bottom);
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

function getDetailSheet(): HTMLElement {
  return document.querySelector('section > section') as HTMLElement;
}

describe('earthquake panel on phones', () => {
  beforeEach(async () => {
    await setViewport(390, 844);
    await cdp().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
  });

  afterEach(async () => {
    await cdp().send('Emulation.setEmulatedMedia', { features: [] });
    await setViewport(1280, 800);
  });

  it('puts back, Event n / total and the arrows in a top bar and Replay and the view toggle under it', async () => {
    const { screen } = await renderPanel(`/?quake=emsc:${EARLY_ID}`);
    const back = screen.getByRole('button', { name: 'Back to globe' });
    await expect.element(screen.getByText('Event 1 / 2')).toBeVisible();
    const caption = getRect(screen.getByText('Event 1 / 2').element());
    const backRect = getRect(back.element());
    const previous = getRect(screen.getByRole('button', { name: 'Previous Earthquake' }).element());
    const next = getRect(screen.getByRole('button', { name: 'Next Earthquake' }).element());
    const replay = getRect(screen.getByRole('button', { name: 'Replay wave' }).element());
    const toggle = getRect(screen.getByTestId('view-toggle').element());

    expect(backRect).toMatchObject({ left: 16, top: 50, width: 34, height: 34 });
    expect(previous).toMatchObject({ left: 298, top: 50, width: 34, height: 34 });
    expect(next).toMatchObject({ left: 340, top: 50, width: 34, height: 34 });
    expect((caption.left + caption.right) / 2).toBeCloseTo((backRect.right + previous.left) / 2, 0);
    expect(replay).toMatchObject({ left: 16, top: 96, height: 32 });
    expect(toggle).toMatchObject({ right: 374, top: 96, height: 32 });
    expect(replay.right).toBeLessThan(toggle.left);
  });

  it('gives every top-bar and action-row control a 44 px hit area that does not overlap its neighbours', async () => {
    const { screen } = await renderPanel(`/?quake=emsc:${LATE_ID}`);
    await expect.element(screen.getByText('Event 2 / 2')).toBeVisible();
    const [back, previous, next, replay] = [
      'Back to globe',
      'Previous Earthquake',
      'Next Earthquake',
      'Replay wave',
    ].map((name) => getHitRect(screen.getByRole('button', { name }).element()));
    const [map, section] = screen
      .getByTestId('view-toggle')
      .element()
      .querySelectorAll('label')
      .values()
      .map(getHitRect)
      .toArray();

    for (const hit of [back, previous, next, replay, map, section]) {
      expect.soft(hit.width).toBeGreaterThanOrEqual(44);
      expect.soft(hit.height).toBeGreaterThanOrEqual(44);
    }
    expect(previous.right).toBeLessThanOrEqual(next.left);
    expect(back.bottom).toBeLessThanOrEqual(replay.top);
    expect(previous.bottom).toBeLessThanOrEqual(section.top);
    expect(map.right).toBeLessThanOrEqual(section.left);
    expect(next.right).toBeLessThanOrEqual(390);
    expect(getHitButton(16 - 4.5, 67)).toBe(
      screen.getByRole('button', { name: 'Back to globe' }).element(),
    );
  });

  it('keeps the top bar and action row inside 16 px margins at 320 px', async () => {
    await setViewport(320, 640);
    const { screen } = await renderPanel(`/?quake=emsc:${EARLY_ID}`);
    await expect.element(screen.getByRole('button', { name: 'Replay wave' })).toBeVisible();

    const replay = getRect(screen.getByRole('button', { name: 'Replay wave' }).element());
    const toggle = getRect(screen.getByTestId('view-toggle').element());
    for (const name of ['Back to globe', 'Previous Earthquake', 'Next Earthquake', 'Replay wave']) {
      const rect = getRect(screen.getByRole('button', { name }).element());
      expect.soft(rect.left, name).toBeGreaterThanOrEqual(16);
      expect.soft(rect.right, name).toBeLessThanOrEqual(304);
    }
    expect(toggle.right).toBe(304);
    expect(replay.right).toBeLessThan(toggle.left);
    expect(document.documentElement.scrollWidth).toBe(320);
  });

  it('switches to the Section view from the toggle', async () => {
    const { screen, router } = await renderPanel(`/?quake=emsc:${EARLY_ID}`);

    await screen.getByText('Section', { exact: true }).click();

    await expect.poll(() => router.state.location.search.view).toBe('section');
  });

  it('shows magnitude, place, time, depth and More details in the collapsed sheet', async () => {
    const layout = getPhoneLayout(390, 844);
    const { screen } = await renderPanel('/?quake=usgs:us6000u18k');
    await expect.element(screen.getByText('7.7', { exact: true })).toBeVisible();

    const sheet = getDetailSheet();
    expect(getRect(sheet).top).toBe(layout.detailSheetTop);
    const magnitude = screen.getByText('7.7', { exact: true }).element();
    expect(getComputedStyle(magnitude).fontSize).toBe('72px');
    const place = screen.getByRole('heading', { level: 2 }).element();
    expect(getComputedStyle(place).fontSize).toBe('17px');
    expect(getRect(place).left).toBeGreaterThan(getRect(magnitude).right);
    await expect.element(screen.getByTestId('depth-scale')).toBeVisible();
    expect(getRect(screen.getByTestId('depth-scale').element()).bottom).toBeLessThan(844);
    await expect.element(screen.getByRole('button', { name: 'More details' }).last()).toBeVisible();
    await expect.element(screen.getByText('1,805')).not.toBeVisible();
  });

  it('expands from More details to Likely felt, Felt reports, Type, Source and Sequence in two columns', async () => {
    const layout = getPhoneLayout(390, 844);
    const { screen } = await renderPanel('/?quake=emsc:small', { list: SEQUENCE });
    await expect.element(screen.getByRole('heading', { level: 2 })).toBeVisible();
    await expect.element(screen.getByText('Sequence')).not.toBeVisible();
    await expect.element(screen.getByText('Likely felt', { exact: true })).not.toBeVisible();

    await screen.getByRole('button', { name: 'More details' }).last().click();

    await expect.poll(() => getRect(getDetailSheet()).top).toBe(layout.detailSheetOpenTop);
    await expect.element(screen.getByRole('button', { name: 'Less' }).last()).toBeVisible();
    const felt = getRect(screen.getByText('Likely felt', { exact: true }).element());
    const type = getRect(screen.getByText('Type', { exact: true }).element());
    const source = getRect(screen.getByText('Source', { exact: true }).element());
    expect(type.left).toBeGreaterThan(felt.left + 150);
    expect(type.top).toBe(felt.top);
    expect(source.left).toBe(felt.left);
    expect(source.top).toBeGreaterThan(felt.top);
    await expect.element(screen.getByText('Sequence')).toBeVisible();
  });

  it('keeps the sheet expanded when stepping to the next Earthquake', async () => {
    const layout = getPhoneLayout(390, 844);
    const { screen, router } = await renderPanel(`/?quake=emsc:${EARLY_ID}`);
    await expect.element(screen.getByText('Event 1 / 2')).toBeVisible();
    await screen.getByRole('button', { name: 'More details' }).last().click();
    await expect.poll(() => getRect(getDetailSheet()).top).toBe(layout.detailSheetOpenTop);

    await screen.getByRole('button', { name: 'Next Earthquake' }).click();

    await expect.poll(() => router.state.location.search.quake).toBe(`emsc:${LATE_ID}`);
    await expect.element(screen.getByRole('heading', { name: /Near Coast Of Peru/ })).toBeVisible();
    expect(getRect(getDetailSheet()).top).toBe(layout.detailSheetOpenTop);
    await expect.element(screen.getByRole('button', { name: 'Less' }).last()).toBeVisible();
  });

  it('scrolls the sheet back to the top when another Earthquake opens, staying expanded', async () => {
    await setViewport(320, 640);
    const openTop = getDetailSheetOpenTop(getPhoneLayout(320, 640));
    const { screen, router } = await renderPanel('/?quake=emsc:small', { list: SEQUENCE });
    await expect.element(screen.getByRole('heading', { level: 2 })).toBeVisible();
    await screen.getByRole('button', { name: 'More details' }).last().click();
    await expect.poll(() => getRect(getDetailSheet()).top).toBe(openTop);
    const body = getDetailSheet().querySelector(':scope > div') as HTMLElement;
    body.scrollTo({ top: body.scrollHeight });
    await expect.poll(() => body.scrollTop).toBeGreaterThan(0);

    await screen.getByRole('button', { name: /M6\.2 .* Largest/ }).click();

    await expect.poll(() => router.state.location.search.quake).toBe('emsc:main');
    await expect.poll(() => body.scrollTop).toBe(0);
    expect(getRect(getDetailSheet()).top).toBe(openTop);
  });
});
