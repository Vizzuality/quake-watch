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
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import EarthquakePanel from '@/containers/earthquake-panel/earthquake-panel';
import { listenForTooltipEscape } from '@/containers/globe/use-hovered-quake';
import { subscribeWaveReplay } from '@/containers/globe/wave-replay';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { usgsPanamaDetail } from '@/test/fixtures/usgs-detail';
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
