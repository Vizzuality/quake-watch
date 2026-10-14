import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { REDUCED_MOTION_QUERY } from '@/containers/earthquake-detail/shared/shaking/use-wave-playback';
import type { CrustCell } from '@/lib/crust/types';
import { getEmscDetailFeature } from '@/test/fixtures/emsc-detail';
import { getFeltReportsCsv, getFeltReportsZip } from '@/test/fixtures/felt-reports-zip';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

const mocks = vi.hoisted(() => ({
  getCrustCells: vi.fn<(args: { data: unknown }) => Promise<CrustCell[]>>(),
}));

vi.mock('@/server/crust', () => ({ getCrustCells: mocks.getCrustCells }));
vi.mock('@/containers/earthquake-detail/crustal-block/webgl-support', () => ({
  isWebGL2Available: () => false,
}));

import { EmscDetailPage } from './emsc-detail-page';

const ID = '20261009_0000264';
const SECTION_TITLE = 'Felt reports (EMSC)';
const SLIDER_NAME = 'Time since the rupture start';
const PLAY_NAME = 'Play the seismic waves';
const PAUSE_NAME = 'Pause the seismic waves';
const NONE_NOTE = 'No felt reports published yet for this Earthquake.';
const BASEMAP_STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background' }],
};
const EPICENTER = { longitude: 152.1142, latitude: -5.4162 };

const CELL: CrustCell = {
  latitude: -5.5,
  longitude: 152.5,
  boundaryElevationsKm: [0.8, 0.8, 0.8, -0.2, -2.0, -2.0, -11.83, -21.65, -31.77],
};

function getRows(longitude: number, latitude: number, intensity: number, count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) =>
      `${longitude + index * 1e-5},${latitude},2026-10-09T01:02:03Z,app,${intensity},${intensity}`,
  );
}

const CLUSTER_ROWS = [
  ...getRows(EPICENTER.longitude, EPICENTER.latitude, 4, 23),
  ...getRows(EPICENTER.longitude + 0.12, EPICENTER.latitude, 6, 5),
  ...getRows(EPICENTER.longitude + 4, EPICENTER.latitude + 4, 3, 1),
  ...getRows(EPICENTER.longitude - 4, EPICENTER.latitude - 4, 3, 1),
];

const NEAR_ROWS = Array.from({ length: 9 }, (_, index) =>
  getRows(EPICENTER.longitude + index * 0.1, EPICENTER.latitude, 4, 2),
).flat();
const OUTLIER_ROWS = getRows(EPICENTER.longitude + 10, EPICENTER.latitude, 3, 1);
const OUTLIER_S_ARRIVAL_SECONDS = 270;

const CSV_ROWS = [
  ...getRows(EPICENTER.longitude, EPICENTER.latitude, 4, 23),
  ...getRows(EPICENTER.longitude + 0.3, EPICENTER.latitude + 0.2, 3, 1),
  ...getRows(EPICENTER.longitude - 0.3, EPICENTER.latitude - 0.2, 5, 5),
  ...getRows(EPICENTER.longitude + 0.3, EPICENTER.latitude + 0.2, 12, 4),
];

type ReportsResponse = () => Response | Promise<Response>;

async function getZipResponse(rows: string[]): Promise<Response> {
  return new Response(await getFeltReportsZip({ [`${ID}.csv`]: getFeltReportsCsv(rows) }));
}

function stubEmsc(reports: ReportsResponse) {
  return stubFetch([
    {
      match: (url) => url.pathname.includes('testimonies-ws'),
      respond: reports,
    },
    {
      match: (url) => url.hostname === 'www.seismicportal.eu' && url.searchParams.has('eventid'),
      respond: () => Response.json(getEmscDetailFeature({ id: ID })),
    },
    {
      match: (url) =>
        url.hostname === 'tiles.openfreemap.org' && url.pathname.startsWith('/fonts/'),
      respond: () => new Response(new ArrayBuffer(0)),
    },
    {
      match: (url) => url.hostname === 'tiles.openfreemap.org',
      respond: () => Response.json(BASEMAP_STYLE),
    },
    { match: () => true, respond: () => new Response(null, { status: 404 }) },
  ]);
}

function getRequestedReports(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('testimonies-ws'));
}

function getMediaQueryList(query: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

function stubReducedMotion() {
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
    query === REDUCED_MOTION_QUERY ? getMediaQueryList(query, true) : matchMedia(query),
  );
}

function getSliderValue(slider: { element: () => Element }): number {
  return Number((slider.element() as HTMLInputElement).value);
}

async function getIsStill(slider: { element: () => Element }): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const before = getSliderValue(slider);
  await new Promise((resolve) => setTimeout(resolve, 400));
  return getSliderValue(slider) === before;
}

type ObservedTarget = {
  callback: IntersectionObserverCallback;
  observer: IntersectionObserver;
  target: Element;
};

function stubIntersectionObserver() {
  const observed = new Set<ObservedTarget>();
  class FakeIntersectionObserver {
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      observed.add({
        callback: this.callback,
        observer: this as unknown as IntersectionObserver,
        target,
      });
    }
    disconnect() {
      for (const entry of observed)
        if (entry.observer === (this as unknown)) observed.delete(entry);
    }
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  return function setIntersecting(isIntersecting: boolean) {
    flushSync(() => {
      for (const { callback, observer, target } of observed) {
        callback([{ isIntersecting, target } as IntersectionObserverEntry], observer);
      }
    });
  };
}

type Screen = Awaited<ReturnType<typeof renderPage>>['screen'];

async function renderPage() {
  return renderWithRouter(() => <EmscDetailPage earthquakeId={ID} />, `/earthquakes/emsc/${ID}`);
}

async function renderVisibleSection(rows = CSV_ROWS) {
  stubEmsc(() => getZipResponse(rows));
  return renderScrolledSection();
}

async function renderScrolledSection() {
  const { screen } = await renderPage();
  const heading = screen.getByRole('heading', { level: 2, name: SECTION_TITLE });
  await expect.element(heading).toBeInTheDocument();
  heading.element().scrollIntoView({ block: 'start' });
  return screen;
}

async function renderObservedSection() {
  const setIntersecting = stubIntersectionObserver();
  stubEmsc(() => getZipResponse(CSV_ROWS));
  const { screen } = await renderPage();
  await expect
    .element(screen.getByRole('heading', { level: 2, name: SECTION_TITLE }))
    .toBeInTheDocument();
  setIntersecting(true);
  return { screen, setIntersecting };
}

async function getMapCanvas(screen: Screen): Promise<HTMLCanvasElement> {
  const figure = screen.getByRole('figure', { name: /Map of the felt reports/ });
  const find = () => figure.element().querySelector<HTMLCanvasElement>('canvas.maplibregl-canvas');
  await expect.poll(find, { timeout: 5_000 }).not.toBeNull();
  return find() as HTMLCanvasElement;
}

describe('EmscFeltReportsSection', () => {
  beforeEach(() => {
    mocks.getCrustCells.mockReset();
    mocks.getCrustCells.mockResolvedValue([CELL]);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await page.viewport(1280, 800);
  });

  it('shows an informational note when EMSC answers 204', async () => {
    stubEmsc(() => new Response(null, { status: 204 }));
    const screen = await renderScrolledSection();

    const section = screen.getByRole('region', { name: SECTION_TITLE });
    await expect.element(section.getByRole('note')).toHaveTextContent(NONE_NOTE);
    expect(section.getByRole('alert').elements()).toHaveLength(0);
    expect(section.getByRole('slider').elements()).toHaveLength(0);
  });

  it('shows the same note when every report has code 11 or 12', async () => {
    const screen = await renderVisibleSection([
      ...getRows(152.1, -5.4, 11, 3),
      ...getRows(152.2, -5.5, 12, 2),
    ]);

    const section = screen.getByRole('region', { name: SECTION_TITLE });
    await expect.element(section.getByRole('note')).toHaveTextContent(NONE_NOTE);
    expect(section.getByRole('slider').elements()).toHaveLength(0);
  });

  it('shows a persistent inline alert with retry when the fetch fails, leaving the page intact', async () => {
    stubEmsc(() => new Response(null, { status: 500 }));
    const screen = await renderScrolledSection();

    const alert = screen.getByRole('alert');
    await expect
      .element(alert.getByText("Couldn't load the felt reports from EMSC."), { timeout: 5_000 })
      .toBeVisible();
    await expect.element(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
    for (const name of ['Key facts', 'Crustal block', 'Location details']) {
      await expect.element(screen.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    expect(screen.getByRole('slider').elements()).toHaveLength(0);
  });

  it('fetches the felt reports only once the section scrolls into view', async () => {
    await page.viewport(1280, 300);
    const fetchMock = stubEmsc(() => getZipResponse(CSV_ROWS));
    const { screen } = await renderPage();

    const heading = screen.getByRole('heading', { level: 2, name: SECTION_TITLE });
    await expect.element(heading).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(heading.element().getBoundingClientRect().top).toBeGreaterThan(window.innerHeight);
    expect(getRequestedReports(fetchMock)).toHaveLength(0);

    heading.element().scrollIntoView({ block: 'start' });
    await expect.poll(() => getRequestedReports(fetchMock), { timeout: 5_000 }).toHaveLength(1);
    await expect
      .element(screen.getByRole('slider', { name: SLIDER_NAME }), { timeout: 5_000 })
      .toBeInTheDocument();
  });

  it('autoplays once visible', async () => {
    const screen = await renderVisibleSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.element(slider).toBeVisible();
    await expect.poll(() => getSliderValue(slider), { timeout: 5_000 }).toBeGreaterThan(0);
    await expect
      .element(screen.getByRole('figure', { name: /Map of the felt reports/ }))
      .toBeVisible();
    expect(document.body.textContent).toContain('EMSC-CSEM, CC BY 4.0');
  });

  it('starts at the final state when motion is reduced and reads the cell under the pointer', async () => {
    stubReducedMotion();
    const screen = await renderVisibleSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.element(slider).toBeInTheDocument();
    const max = slider.element().getAttribute('max');
    expect(Number(max)).toBeGreaterThan(0);
    await expect.element(slider).toHaveValue(max);
    await expect.element(screen.getByRole('button', { name: PLAY_NAME })).toBeVisible();

    await userEvent.hover(await getMapCanvas(screen));
    await expect
      .element(screen.getByText('Intensity IV · Light — 23 reports'), { timeout: 5_000 })
      .toBeVisible();
    expect(screen.getByText(/ — 4 reports/).elements()).toHaveLength(0);
  });

  it('reads the average Intensity and report count of a bubble grouping nearby cells', async () => {
    stubReducedMotion();
    const screen = await renderVisibleSection(CLUSTER_ROWS);

    await expect.element(screen.getByRole('slider', { name: SLIDER_NAME })).toBeInTheDocument();
    await userEvent.hover(await getMapCanvas(screen));
    await expect
      .element(screen.getByText('Intensity V · Moderate — 28 reports'), { timeout: 5_000 })
      .toBeVisible();
  });

  it('shows the strongest Intensity with the number of reports behind it', async () => {
    const screen = await renderVisibleSection();

    const section = screen.getByRole('region', { name: SECTION_TITLE });
    await expect.element(section.getByText('VI · Strong (5 reports)')).toBeVisible();
    await expect.element(section.getByText('29', { exact: true })).toBeVisible();
  });

  it('ends the run once the framed cells have settled, not at far-flung outliers', async () => {
    stubReducedMotion();
    const screen = await renderVisibleSection([...NEAR_ROWS, ...OUTLIER_ROWS]);

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.element(slider).toBeInTheDocument();
    const max = Number(slider.element().getAttribute('max'));
    expect(max).toBeGreaterThan(20);
    expect(max).toBeLessThan(OUTLIER_S_ARRIVAL_SECONDS);
    await expect.element(slider).toHaveValue(String(max));
  });

  it('shows no readout where the S wave has not arrived yet', async () => {
    stubReducedMotion();
    const screen = await renderVisibleSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.element(slider).toBeInTheDocument();
    (slider.element() as HTMLInputElement).focus();
    await userEvent.keyboard('{Home}');
    await expect.element(slider).toHaveValue('0');
    await userEvent.hover(await getMapCanvas(screen));
    const readout = screen.getByText('Intensity IV · Light — 23 reports');

    await userEvent.keyboard('{End}');
    await expect.element(readout, { timeout: 5_000 }).toBeVisible();
    await userEvent.keyboard('{Home}');
    await expect.element(slider).toHaveValue('0');
    await expect.element(readout).not.toBeInTheDocument();
  });

  it('stops advancing while the section is out of view', async () => {
    const { screen, setIntersecting } = await renderObservedSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.poll(() => getSliderValue(slider), { timeout: 5_000 }).toBeGreaterThan(0);
    setIntersecting(false);
    expect(await getIsStill(slider)).toBe(true);
    expect(getSliderValue(slider)).toBeLessThan(Number(slider.element().getAttribute('max')));
  });

  it('stops advancing while the tab is hidden and autoplays only once', async () => {
    const { screen, setIntersecting } = await renderObservedSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.poll(() => getSliderValue(slider), { timeout: 5_000 }).toBeGreaterThan(0);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(await getIsStill(slider)).toBe(true);
    await screen.getByRole('button', { name: PAUSE_NAME }).click();
    setIntersecting(false);
    setIntersecting(true);
    expect(await getIsStill(slider)).toBe(true);
    await expect.element(screen.getByRole('button', { name: PLAY_NAME })).toBeVisible();
  });
});
