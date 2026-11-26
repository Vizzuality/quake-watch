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

import { FiltersPanel } from '@/containers/filters/filters-panel';
import { getEarthquakesQueryKey } from '@/lib/earthquakes/query-options';
import {
  EARTHQUAKE_SEARCH_ROUTE,
  earthquakeSearchSchema,
  getIsoDate,
} from '@/lib/earthquakes/search-schema';
import { overwriteGetLocale } from '@/paraglide/runtime';

const DAY_MS = 86_400_000;

async function renderPanel(initialEntry = '/', queryClient = getQueryClient()) {
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    ...EARTHQUAKE_SEARCH_ROUTE,
    component: () => (
      <main className="relative min-h-dvh">
        <FiltersPanel />
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
  return { router, screen };
}

function getQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('filters panel', () => {
  afterEach(async () => {
    overwriteGetLocale(() => 'en');
    await page.viewport(1280, 800);
  });

  it('matches the D1 frame geometry at 1440 px', async () => {
    await page.viewport(1440, 900);
    const { screen } = await renderPanel();
    const panel = screen.getByRole('region', { name: 'Filters' });
    await expect.element(panel).toBeVisible();

    const rect = panel.element().getBoundingClientRect();
    expect(rect.left).toBe(1154);
    expect(rect.top).toBe(159);
    expect(rect.width).toBe(230);
    expect(rect.height).toBe(301);
  });

  it('checks the defaults, styles them as Figma and keeps one tab stop per group', async () => {
    const { screen } = await renderPanel();

    for (const name of ['Time', 'Magnitude', 'Depth', 'Source']) {
      await expect.element(screen.getByRole('radiogroup', { name })).toBeVisible();
    }
    for (const name of ['7d', 'EMSC']) {
      await expect.element(screen.getByRole('radio', { name })).toBeChecked();
    }
    await expect.element(screen.getByRole('radio', { name: 'USGS' })).not.toBeChecked();
    expect(screen.container.querySelectorAll('input:checked')).toHaveLength(4);

    const active = getComputedStyle(screen.getByText('7d').element());
    expect(active.color).toBe('rgb(230, 228, 245)');
    expect(active.borderBottomColor).toBe('rgb(230, 228, 245)');
    expect(active.borderBottomWidth).toBe('1px');
    const inactive = getComputedStyle(screen.getByText('24h').element());
    expect(inactive.borderBottomColor).toBe('rgba(0, 0, 0, 0)');
    await userEvent.hover(screen.getByText('7d', { exact: true }));
    await expect.poll(() => active.color).toBe('rgb(235, 89, 142)');

    await userEvent.click(screen.getByText('7d', { exact: true }));
    await userEvent.keyboard('{Tab}');
    await expect
      .element(screen.getByRole('button', { name: 'More about Magnitude' }))
      .toHaveFocus();
    await userEvent.keyboard('{Tab}');
    await expect.element(screen.getByRole('radio', { name: 'All' }).first()).toHaveFocus();
  });

  it('arrow keys move focus and write the param; a reload restores it', async () => {
    const { router, screen } = await renderPanel();
    const time = screen.getByRole('radiogroup', { name: 'Time' });

    await userEvent.click(time.getByText('7d', { exact: true }));
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => router.state.location.searchStr).toBe('?interval=1y');
    await expect.element(time.getByRole('radio', { name: '1y' })).toHaveFocus();
    await expect.element(time.getByRole('radio', { name: '1y' })).toBeChecked();

    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => router.state.location.searchStr).toBe('');

    await userEvent.click(screen.getByText('USGS', { exact: true }));
    await userEvent.click(screen.getByText('5+', { exact: true }));
    await userEvent.click(screen.getByText('Deep', { exact: true }));
    await expect
      .poll(() => router.state.location.searchStr)
      .toBe('?source=usgs&minmag=5&depth=deep');

    const href = router.state.location.href;
    screen.unmount();
    const reloaded = await renderPanel(href);
    for (const name of ['USGS', '5+', 'Deep', '7d']) {
      await expect.element(reloaded.screen.getByRole('radio', { name })).toBeChecked();
    }
  });

  it('puts an Info button next to each filter label without renaming the groups', async () => {
    const { screen } = await renderPanel();

    for (const [name, info] of [
      ['Time', /How far back/],
      ['Magnitude', /logarithmic/],
      ['Depth', /70 km/],
      ['Source', /USGS and EMSC/],
    ] as const) {
      await expect.element(screen.getByRole('radiogroup', { name, exact: true })).toBeVisible();
      await expect
        .element(screen.getByRole('button', { name: `More about ${name}` }))
        .toHaveAccessibleDescription(info);
    }
  });

  it('hides while a quake is selected', async () => {
    const { screen } = await renderPanel('/?quake=usgs:us7000abcd');
    expect(screen.container.querySelector('section')).toBeNull();
  });

  it('renders in Spanish', async () => {
    overwriteGetLocale(() => 'es');
    const { screen } = await renderPanel();
    await expect.element(screen.getByRole('region', { name: 'Filtros' })).toBeVisible();
    await expect.element(screen.getByRole('radiogroup', { name: 'Profundidad' })).toBeVisible();
    await expect.element(screen.getByRole('radio', { name: 'Superficial' })).toBeVisible();
  });

  it('renders in Portuguese', async () => {
    overwriteGetLocale(() => 'pt');
    const { screen } = await renderPanel();
    await expect.element(screen.getByRole('region', { name: 'Filtros' })).toBeVisible();
    await expect.element(screen.getByRole('radiogroup', { name: 'Profundidade' })).toBeVisible();
    await expect.element(screen.getByRole('radio', { name: 'Intermédio' })).toBeVisible();
    await expect.element(screen.getByRole('radio', { name: 'Todos' }).first()).toBeVisible();
  });

  it('offers 1y, Custom and All in the design order', async () => {
    const { screen } = await renderPanel();
    const time = screen.getByRole('radiogroup', { name: 'Time' });
    const source = screen.getByRole('radiogroup', { name: 'Source' });
    expect(time.element().textContent).toBe('24h3d7d1yCustom');
    expect(source.element().textContent).toBe('AllUSGSEMSC');
  });

  it('writes a 30-day custom range to the URL, rejects reversed dates inline and reloads it', async () => {
    const { router, screen } = await renderPanel('/?source=all');
    await userEvent.click(screen.getByText('Custom', { exact: true }));
    const today = getIsoDate(Date.now());
    const start = getIsoDate(Date.now() - 29 * DAY_MS);
    await expect
      .poll(() => router.state.location.searchStr)
      .toBe(`?source=all&interval=custom&from=${start}&to=${today}`);

    const from = screen.getByLabelText('From');
    await expect.element(from).toHaveValue(start);
    await userEvent.fill(from, today);
    await expect.poll(() => router.state.location.search.from).toBe(today);

    await userEvent.fill(screen.getByLabelText('To'), getIsoDate(Date.now() - 2 * DAY_MS));
    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent('The start date must be on or before the end date.');
    await expect.element(from).toHaveAttribute('aria-invalid', 'true');
    expect(router.state.location.search.to).toBe(today);

    const href = router.state.location.href;
    screen.unmount();
    const reloaded = await renderPanel(href);
    await expect.element(reloaded.screen.getByRole('radio', { name: 'Custom' })).toBeChecked();
    await expect.element(reloaded.screen.getByLabelText('From')).toHaveValue(today);

    await userEvent.click(reloaded.screen.getByText('1y', { exact: true }));
    await expect
      .poll(() => reloaded.router.state.location.searchStr)
      .toBe('?source=all&interval=1y');
  });

  it('says when a year was cut to the largest earthquakes', async () => {
    const queryClient = getQueryClient();
    const filters = earthquakeSearchSchema.parse({ interval: '1y', source: 'all' });
    queryClient.setQueryData(getEarthquakesQueryKey(filters), {
      earthquakes: [],
      isTruncated: true,
      fetchedAt: Date.now(),
    });
    const { screen } = await renderPanel('/?interval=1y&source=all', queryClient);
    await expect
      .element(screen.getByTestId('filter-truncated'))
      .toHaveTextContent('Largest 5,000 per catalogue shown');
  });

  it.each(['en', 'es', 'pt'] as const)(
    'keeps the Time options and both dates on one line each at 320 px in %s',
    async (locale) => {
      overwriteGetLocale(() => locale);
      await page.viewport(320, 640);
      const { screen } = await renderPanel('/?interval=custom&from=2026-01-01&to=2026-01-31');
      const panel = screen.getByRole('region').element();
      (panel.parentElement as HTMLElement).style.padding = '0 20px';
      const options = [...panel.querySelectorAll('[role=radiogroup]')[0].children];
      const tops = new Set(options.map((option) => option.getBoundingClientRect().top));
      expect(tops.size).toBe(1);
      for (const element of [...options, ...panel.querySelectorAll('input[type=date]')]) {
        expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(300);
      }
      expect(document.documentElement.scrollWidth).toBe(320);
    },
  );
  it.each(['en', 'es', 'pt'] as const)(
    'wraps desktop options that do not fit the 230 px panel instead of squeezing them in %s',
    async (locale) => {
      overwriteGetLocale(() => locale);
      await page.viewport(1440, 900);
      const { screen } = await renderPanel();
      const panel = screen.getByRole('region').element();
      (panel.parentElement as HTMLElement).style.width = '230px';
      const panelRight = panel.getBoundingClientRect().right;
      for (const span of panel.querySelectorAll<HTMLElement>('[role=radiogroup] span')) {
        expect(span.scrollWidth).toBeLessThanOrEqual(span.clientWidth);
        expect(span.getBoundingClientRect().right).toBeLessThanOrEqual(panelRight);
      }
    },
  );
});
