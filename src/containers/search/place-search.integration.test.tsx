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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';

import { listenForTooltipEscape } from '@/containers/globe/use-hovered-quake';
import { PlaceSearch } from '@/containers/search/place-search';
import { SummaryPanel } from '@/containers/summary/summary-panel';
import { playbackClock } from '@/lib/earthquakes/playback-clock';
import { EARTHQUAKE_SEARCH_ROUTE } from '@/lib/earthquakes/search-schema';
import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

const DENIED_COPY =
  'Location access is blocked. Allow it in your browser settings to find earthquakes near you.';
const VANUATU = { lat: -17.7, lon: 168.3 };
const VANUATU_AREA = '/?place=Vanuatu&plat=-16&plon=167&radius=250';

function getPhotonFeature(
  name: string,
  country: string,
  [lon, lat]: [number, number],
  extent: number[],
) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { osm_type: 'R', osm_id: Math.round(Math.abs(lon * 1000)), name, country, extent },
  };
}

function getPhotonResponse(url: URL): Response {
  const query = url.searchParams.get('q') ?? '';
  if (query.startsWith('fail')) return new Response(null, { status: 429 });
  const features = query.toLowerCase().startsWith('vanu')
    ? [
        getPhotonFeature('Vanuatu', 'Vanuatu', [167, -16], [166.5, -13, 170.2, -20.3]),
        getPhotonFeature('Vanua Levu', 'Fiji', [179.2, -16.6], [178.4, -16.1, 180, -17.1]),
      ]
    : [];
  return Response.json({ type: 'FeatureCollection', features });
}

function stubPosition(latitude: number, longitude: number) {
  return vi
    .spyOn(navigator.geolocation, 'getCurrentPosition')
    .mockImplementation((onSuccess) =>
      onSuccess({ coords: { latitude, longitude } } as GeolocationPosition),
    );
}

function stubPositionError(code: number) {
  return vi
    .spyOn(navigator.geolocation, 'getCurrentPosition')
    .mockImplementation((_onSuccess, onError) =>
      onError?.({ code, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    );
}

type AreaSearch = { place?: string; plat?: number; plon?: number; radius?: number };

function getAreaSearch(router: { state: { location: { search: unknown } } }): AreaSearch {
  const { place, plat, plon, radius } = router.state.location.search as AreaSearch;
  return { place, plat, plon, radius };
}

function getPlaceSearch(router: { state: { location: { search: unknown } } }) {
  return getAreaSearch(router).place;
}

async function renderSearch(initialEntry = '/') {
  stubFetch([
    {
      match: (url) => url.hostname === 'photon.komoot.io',
      respond: getPhotonResponse,
    },
    {
      match: () => true,
      respond: () =>
        Response.json(
          getFeatureCollection([
            getEmscFeature({
              id: 'a',
              time: '2026-10-27T10:00:00.000Z',
              mag: 6.2,
              region: 'VANUATU',
              ...VANUATU,
            }),
            getEmscFeature({
              id: 'b',
              time: '2026-10-29T10:00:00.000Z',
              mag: 4.1,
              region: 'VANUATU',
              ...VANUATU,
            }),
            getEmscFeature({
              id: 'c',
              time: '2026-10-28T10:00:00.000Z',
              mag: 4.4,
              region: 'VANUATU ISLANDS REGION',
              lat: -14.2,
              lon: 167.1,
            }),
            getEmscFeature({ id: 'd', time: '2026-10-30T10:00:00.000Z', mag: 3.1 }),
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
      <main className="relative h-dvh">
        <SummaryPanel />
        <PlaceSearch />
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
  await expect.element(screen.getByTestId('summary')).toBeInTheDocument();
  return { screen, router, combobox: screen.getByRole('combobox', { name: 'Search a place' }) };
}

describe('place search', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    playbackClock.setRange(null);
    await page.viewport(1280, 800);
  });

  it('lists the geocoded places matching the text', async () => {
    const { screen, combobox } = await renderSearch();

    await userEvent.type(combobox, 'Vanu');

    const options = screen.getByRole('option');
    await expect.element(options.nth(0)).toHaveTextContent('Vanuatu');
    await expect.element(options.nth(1)).toHaveTextContent('Vanua Levu, Fiji');
    expect(options.elements()).toHaveLength(2);
    await expect.element(combobox).toHaveAttribute('aria-expanded', 'true');
    await expect
      .element(combobox)
      .toHaveAttribute('aria-controls', screen.getByRole('listbox').element().id);
  });

  it('asks for three letters before searching', async () => {
    const { screen, combobox } = await renderSearch();

    await userEvent.type(combobox, 'Va');

    await expect.element(screen.getByRole('status')).toHaveTextContent('Type at least 3 letters.');
    await expect.element(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('moves the active option with the arrows and picks it with Enter', async () => {
    const { screen, router, combobox } = await renderSearch();
    await userEvent.type(combobox, 'Vanu');
    const options = screen.getByRole('option');

    await expect.element(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    expect(combobox.element().getAttribute('aria-activedescendant')).toBe(
      options.nth(0).element().id,
    );
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    expect(combobox.element().getAttribute('aria-activedescendant')).toBe(
      options.nth(1).element().id,
    );
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Enter}');

    await expect
      .poll(() => getAreaSearch(router))
      .toEqual({ place: 'Vanuatu', plat: -16, plon: 167, radius: 250 });
    await expect.element(combobox).toHaveValue('Vanuatu');
    await expect.element(combobox).toHaveAttribute('aria-expanded', 'false');
    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes the list on Escape without closing the layer under it', async () => {
    const { screen, combobox } = await renderSearch();
    const onLayerEscape = vi.fn<() => void>();
    const stopListening = listenForTooltipEscape(onLayerEscape);
    await userEvent.type(combobox, 'Vanu');
    await expect.element(screen.getByRole('listbox')).toBeVisible();

    await userEvent.keyboard('{Escape}');

    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
    await expect.element(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(onLayerEscape).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onLayerEscape).toHaveBeenCalledOnce();
    stopListening();
  });

  it('picks a place by click and counts the Earthquakes within its radius', async () => {
    const { screen, router, combobox } = await renderSearch();
    await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('4');

    await userEvent.type(combobox, 'vanuatu');
    await screen.getByRole('option').nth(0).click();

    await expect.poll(() => getPlaceSearch(router)).toBe('Vanuatu');
    await expect
      .element(screen.getByTestId('summary-eyebrow'))
      .toHaveTextContent('In view · Vanuatu');
    await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('3');
    await expect
      .element(screen.getByRole('term').nth(1).getByText('Largest here', { exact: true }))
      .toBeVisible();
    await expect.element(screen.getByRole('definition').nth(1)).toHaveTextContent('6.2');
  });

  it('says when no place matches the text', async () => {
    const { screen, combobox } = await renderSearch();

    await userEvent.type(combobox, 'Atlantis');

    await expect
      .element(screen.getByRole('status'))
      .toHaveTextContent('No places match that name.');
    await expect.element(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps an inline alert next to the field when the place search fails', async () => {
    const { screen, combobox } = await renderSearch();

    await userEvent.type(combobox, 'failing');

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent("Place search isn't available right now. Try again in a moment.");
    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
  });

  it('removes the area and leaves area mode when the field is cleared', async () => {
    const { screen, router, combobox } = await renderSearch(VANUATU_AREA);
    await expect.element(combobox).toHaveValue('Vanuatu');
    await expect.element(screen.getByTestId('summary-eyebrow')).toBeVisible();

    await screen.getByRole('button', { name: 'Clear search' }).click();

    await expect.poll(() => getAreaSearch(router)).toEqual({});
    await expect.element(combobox).toHaveValue('');
    await expect.element(combobox).toHaveFocus();
    await expect.element(screen.getByTestId('summary-eyebrow')).not.toBeInTheDocument();
    await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('4');
  });

  it('removes the area when the text is deleted', async () => {
    const { router, combobox } = await renderSearch(VANUATU_AREA);

    await userEvent.clear(combobox);

    await expect.poll(() => getAreaSearch(router)).toEqual({});
  });

  it('shows the area empty state when the place has no Earthquakes at the playhead', async () => {
    const { screen } = await renderSearch(VANUATU_AREA);
    playbackClock.setRange({
      start: Date.parse('2026-10-26T00:00:00.000Z'),
      end: Date.parse('2026-11-02T00:00:00.000Z'),
    });

    playbackClock.seek(Date.parse('2026-10-26T12:00:00.000Z'));

    await expect
      .element(
        screen.getByText(
          'No earthquakes here in this interval. Try a longer interval or zoom out.',
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByTestId('summary-eyebrow'))
      .toHaveTextContent('In view · Vanuatu');
    await expect.element(screen.getByTestId('summary-count')).not.toBeInTheDocument();
  });

  it('filters the Earthquakes within 100 km of the user location', async () => {
    const { screen, router, combobox } = await renderSearch(VANUATU_AREA);
    stubPosition(37.2, -3.6);

    await screen.getByRole('button', { name: 'Use my location' }).click();

    await expect
      .poll(() => getAreaSearch(router))
      .toEqual({ place: undefined, plat: 37.2, plon: -3.6, radius: undefined });
    await expect.element(combobox).toHaveValue('');
    await expect.element(combobox).toHaveAttribute('placeholder', 'My location');
    await expect
      .element(screen.getByTestId('summary-eyebrow'))
      .toHaveTextContent('In view · My location');
    await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('1');
    await expect.element(screen.getByRole('button', { name: 'Clear search' })).toBeVisible();
  });

  it('keeps an inline message next to the field when location access is denied', async () => {
    const { screen, router, combobox } = await renderSearch();
    stubPositionError(1);

    await screen.getByRole('button', { name: 'Use my location' }).click();

    const alert = screen.getByRole('alert');
    await expect.element(alert).toHaveTextContent(DENIED_COPY);
    expect(getPlaceSearch(router)).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect.element(alert).toBeVisible();

    await userEvent.type(combobox, 'V');
    await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
  });

  it('says the location is unavailable when the position cannot be read', async () => {
    const { screen } = await renderSearch();
    stubPositionError(2);

    await screen.getByRole('button', { name: 'Use my location' }).click();

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent("Your location isn't available right now. Try again or search a place.");
  });

  it('draws the block caret at the insertion point while typing', async () => {
    await page.viewport(1440, 900);
    const { screen, combobox } = await renderSearch();
    const caret = screen.getByTestId('search-caret');
    await expect.element(caret).not.toBeVisible();

    await userEvent.type(combobox, 'Van');

    await expect.element(caret).toBeVisible();
    const input = combobox.element().getBoundingClientRect();
    const caretRect = caret.element().getBoundingClientRect();
    expect(caretRect.width).toBeCloseTo(9.8, 1);
    expect(caretRect.height).toBeCloseTo(12.1, 1);
    expect(caretRect.left).toBeGreaterThan(input.left + 10);
    expect(getComputedStyle(caret.element()).backgroundColor).toBe('rgb(235, 89, 142)');
    expect(getComputedStyle(combobox.element()).caretColor).toBe('rgba(0, 0, 0, 0)');

    const typedLeft = caretRect.left;
    await userEvent.keyboard('{Home}');
    await expect
      .poll(() => caret.element().getBoundingClientRect().left)
      .toBeCloseTo(input.left, 0);
    expect(typedLeft).toBeGreaterThan(input.left);
    combobox.element().blur();
    await expect.element(caret).not.toBeVisible();
  });

  it('is hidden while an Earthquake is selected', async () => {
    const { screen } = await renderSearch('/?quake=emsc:a');

    await expect.element(screen.getByRole('combobox')).not.toBeInTheDocument();
  });

  it('matches the D5 search field geometry at 1440×900', async () => {
    await page.viewport(1440, 900);
    const { screen, combobox } = await renderSearch();
    const field = screen.getByTestId('place-search').element().getBoundingClientRect();
    const input = getComputedStyle(combobox.element());

    expect(field.left).toBe(56);
    expect(field.width).toBe(257);
    expect(field.bottom).toBe(844);
    expect(field.height).toBe(27);
    expect(input.fontSize).toBe('10px');
    expect(input.fontWeight).toBe('700');
    expect(input.textTransform).toBe('uppercase');
    expect(input.color).toBe('rgb(230, 228, 245)');
  });
});
