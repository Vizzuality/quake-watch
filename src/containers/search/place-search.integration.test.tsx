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

const EMPTY_COPY = 'No earthquakes near a place with that name. Try a country or region.';

function getPlaceSearch(router: { state: { location: { search: unknown } } }) {
  return (router.state.location.search as { place?: string }).place;
}

async function renderSearch(initialEntry = '/') {
  stubFetch([
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
            }),
            getEmscFeature({
              id: 'b',
              time: '2026-10-29T10:00:00.000Z',
              mag: 4.1,
              region: 'VANUATU',
            }),
            getEmscFeature({
              id: 'c',
              time: '2026-10-28T10:00:00.000Z',
              mag: 4.4,
              region: 'VANUATU ISLANDS REGION',
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
    playbackClock.setRange(null);
    await page.viewport(1280, 800);
  });

  it('lists the places matching the text with their counts, Vanuatu first', async () => {
    const { screen, combobox } = await renderSearch();

    await userEvent.type(combobox, 'Vanu');

    const options = screen.getByRole('option');
    await expect.element(options.nth(0)).toHaveTextContent('Vanuatu 2');
    await expect.element(options.nth(1)).toHaveTextContent('Vanuatu Islands 1');
    expect(options.elements()).toHaveLength(2);
    await expect.element(combobox).toHaveAttribute('aria-expanded', 'true');
    await expect
      .element(combobox)
      .toHaveAttribute('aria-controls', screen.getByRole('listbox').element().id);
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
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard('{Enter}');

    await expect.poll(() => getPlaceSearch(router)).toBe('Vanuatu');
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

  it('picks a suggestion by click and switches the Summary to that place', async () => {
    const { screen, router, combobox } = await renderSearch();
    await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('4');

    await userEvent.type(combobox, 'vanuatu');
    await screen.getByRole('option').nth(0).click();

    await expect.poll(() => getPlaceSearch(router)).toBe('Vanuatu');
    await expect
      .element(screen.getByTestId('summary-eyebrow'))
      .toHaveTextContent('In view · Vanuatu');
    await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('2');
    await expect.element(screen.getByRole('term').nth(1)).toHaveTextContent('Largest here');
    await expect.element(screen.getByRole('definition').nth(1)).toHaveTextContent('6.2');
  });

  it('shows the empty-state copy for a place without Earthquakes', async () => {
    const { screen, combobox } = await renderSearch();

    await userEvent.type(combobox, 'Atlantis');

    await expect.element(screen.getByRole('status')).toHaveTextContent(EMPTY_COPY);
    await expect.element(combobox).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{Enter}');
    await expect.element(screen.getByRole('status')).toBeVisible();
  });

  it('removes the place and leaves area mode when the field is cleared', async () => {
    const { screen, router, combobox } = await renderSearch('/?place=Vanuatu');
    await expect.element(combobox).toHaveValue('Vanuatu');
    await expect.element(screen.getByTestId('summary-eyebrow')).toBeVisible();

    await screen.getByRole('button', { name: 'Clear search' }).click();

    await expect.poll(() => getPlaceSearch(router)).toBeUndefined();
    await expect.element(combobox).toHaveValue('');
    await expect.element(combobox).toHaveFocus();
    await expect.element(screen.getByTestId('summary-eyebrow')).not.toBeInTheDocument();
    await expect.element(screen.getByTestId('summary-count')).toHaveTextContent('4');
  });

  it('removes the place when the text is deleted', async () => {
    const { router, combobox } = await renderSearch('/?place=Vanuatu');

    await userEvent.clear(combobox);

    await expect.poll(() => getPlaceSearch(router)).toBeUndefined();
  });

  it('shows the area empty state when the place has no Earthquakes at the playhead', async () => {
    const { screen } = await renderSearch('/?place=Vanuatu');
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
