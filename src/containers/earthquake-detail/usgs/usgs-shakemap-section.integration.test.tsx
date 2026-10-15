import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { REDUCED_MOTION_QUERY } from '@/containers/earthquake-detail/shared/shaking/use-wave-playback';
import type { CrustCell } from '@/lib/crust/types';
import { shakemapContours } from '@/test/fixtures/shakemap-contours';
import { shakemapCoverage } from '@/test/fixtures/shakemap-coverage';
import { usgsOriginOnlyDetail, usgsPanamaDetail } from '@/test/fixtures/usgs-detail';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

const mocks = vi.hoisted(() => ({
  getCrustCells: vi.fn<(args: { data: unknown }) => Promise<CrustCell[]>>(),
}));

vi.mock('@/server/crust', () => ({ getCrustCells: mocks.getCrustCells }));
vi.mock('@/containers/earthquake-detail/crustal-block/webgl-support', () => ({
  isWebGL2Available: () => false,
}));

import { UsgsDetailPage } from './usgs-detail-page';

const SECTION_TITLE = 'Estimated shaking (ShakeMap)';
const SHAKEMAP_PATH = '/product/shakemap/';
const SLIDER_NAME = 'Time since the rupture start';
const PLAY_NAME = 'Play the seismic waves';
const PAUSE_NAME = 'Pause the seismic waves';
const BASEMAP_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background' }],
};

const CELL: CrustCell = {
  latitude: 7.5,
  longitude: -80.5,
  boundaryElevationsKm: [0.8, 0.8, 0.8, -0.2, -2.0, -2.0, -11.83, -21.65, -31.77],
};

type FileResponses = { coverage?: () => Response; contours?: () => Response };

function isShakemapFile(url: URL, file: string): boolean {
  return url.pathname.startsWith(SHAKEMAP_PATH) && url.pathname.endsWith(file);
}

function stubUsgs(detail: unknown, files: FileResponses = {}) {
  return stubFetch([
    { match: (url) => url.searchParams.has('eventid'), respond: () => Response.json(detail) },
    {
      match: (url) => url.hostname === 'tiles.openfreemap.org',
      respond: () => Response.json(BASEMAP_STYLE),
    },
    {
      match: (url) => isShakemapFile(url, 'coverage_mmi_medium_res.covjson'),
      respond: files.coverage ?? (() => Response.json(shakemapCoverage)),
    },
    {
      match: (url) => isShakemapFile(url, 'cont_mmi.json'),
      respond: files.contours ?? (() => Response.json(shakemapContours)),
    },
    { match: () => true, respond: () => new Response(null, { status: 404 }) },
  ]);
}

function getRequestedShakemapFiles(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes(SHAKEMAP_PATH));
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

async function renderObservedSection() {
  const setIntersecting = stubIntersectionObserver();
  stubUsgs(usgsPanamaDetail);
  const { screen } = await renderPage('us6000u18k');
  await expect
    .element(screen.getByRole('heading', { level: 2, name: SECTION_TITLE }))
    .toBeInTheDocument();
  setIntersecting(true);
  return { screen, setIntersecting };
}

async function renderPage(id: string) {
  return renderWithRouter(() => <UsgsDetailPage earthquakeId={id} />, `/earthquakes/usgs/${id}`);
}

async function renderVisibleSection() {
  const { screen } = await renderPage('us6000u18k');
  const heading = screen.getByRole('heading', { level: 2, name: SECTION_TITLE });
  await expect.element(heading).toBeInTheDocument();
  heading.element().scrollIntoView({ block: 'start' });
  return screen;
}

describe('UsgsShakemapSection', () => {
  beforeEach(() => {
    mocks.getCrustCells.mockReset();
    mocks.getCrustCells.mockResolvedValue([CELL]);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await page.viewport(1280, 800);
  });

  it('shows an informational note when the Earthquake has no ShakeMap', async () => {
    const fetchMock = stubUsgs(usgsOriginOnlyDetail);
    const { screen } = await renderPage('us6000u23d');

    const section = screen.getByRole('region', { name: SECTION_TITLE });
    await expect
      .element(section.getByRole('note'))
      .toHaveTextContent('No shaking data published yet for this Earthquake.');
    expect(section.getByRole('alert').elements()).toHaveLength(0);
    expect(section.getByRole('slider').elements()).toHaveLength(0);
    expect(getRequestedShakemapFiles(fetchMock)).toHaveLength(0);
  });

  it('fetches the ShakeMap files only once the section scrolls into view', async () => {
    await page.viewport(1280, 300);
    const fetchMock = stubUsgs(usgsPanamaDetail);
    const { screen } = await renderPage('us6000u18k');

    const heading = screen.getByRole('heading', { level: 2, name: SECTION_TITLE });
    await expect.element(heading).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(heading.element().getBoundingClientRect().top).toBeGreaterThan(window.innerHeight);
    expect(getRequestedShakemapFiles(fetchMock)).toHaveLength(0);

    heading.element().scrollIntoView({ block: 'start' });
    await expect
      .poll(() => getRequestedShakemapFiles(fetchMock), { timeout: 5_000 })
      .toHaveLength(2);
    await expect.element(screen.getByRole('slider', { name: SLIDER_NAME })).toBeInTheDocument();
  });

  it('autoplays the seismic waves once the section is visible', async () => {
    stubUsgs(usgsPanamaDetail);
    const screen = await renderVisibleSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.element(slider).toBeVisible();
    await expect
      .poll(() => Number((slider.element() as HTMLInputElement).value), { timeout: 5_000 })
      .toBeGreaterThan(0);
    await expect
      .element(screen.getByRole('figure', { name: /Map of the estimated shaking/ }))
      .toBeVisible();
    await expect.element(screen.getByText('VI · Strong')).toBeVisible();
  });

  it('stops advancing while the section is out of view', async () => {
    const { screen, setIntersecting } = await renderObservedSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.poll(() => getSliderValue(slider), { timeout: 5_000 }).toBeGreaterThan(0);
    setIntersecting(false);
    expect(await getIsStill(slider)).toBe(true);
    expect(getSliderValue(slider)).toBeLessThan(Number(slider.element().getAttribute('max')));
  });

  it('stops advancing while the tab is hidden', async () => {
    const { screen } = await renderObservedSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.poll(() => getSliderValue(slider), { timeout: 5_000 }).toBeGreaterThan(0);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(await getIsStill(slider)).toBe(true);
    expect(getSliderValue(slider)).toBeLessThan(Number(slider.element().getAttribute('max')));
  });

  it('autoplays only once, not again when the section comes back into view', async () => {
    const { screen, setIntersecting } = await renderObservedSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.poll(() => getSliderValue(slider), { timeout: 5_000 }).toBeGreaterThan(0);
    setIntersecting(false);
    expect(await getIsStill(slider)).toBe(true);
    await screen.getByRole('button', { name: PAUSE_NAME }).click();
    setIntersecting(true);
    expect(await getIsStill(slider)).toBe(true);
    await expect.element(screen.getByRole('button', { name: PLAY_NAME })).toBeVisible();
  });

  it('starts at the final state without animation when motion is reduced', async () => {
    stubReducedMotion();
    stubUsgs(usgsPanamaDetail);
    const screen = await renderVisibleSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.element(slider).toBeInTheDocument();
    const max = slider.element().getAttribute('max');
    expect(Number(max)).toBeGreaterThan(0);
    await expect.element(slider).toHaveValue(max);
    await expect
      .element(slider)
      .toHaveAttribute(
        'aria-valuetext',
        `${Number(max).toLocaleString('en')} s of ${Number(max).toLocaleString('en')} s since the rupture start`,
      );
    await expect.element(screen.getByRole('button', { name: PLAY_NAME })).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect.element(slider).toHaveValue(max);
  });

  it('steps through real seconds with the keyboard and toggles playback with Space', async () => {
    stubReducedMotion();
    stubUsgs(usgsPanamaDetail);
    const screen = await renderVisibleSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect.element(slider).toBeInTheDocument();
    const max = Number(slider.element().getAttribute('max'));
    await expect.element(slider).toHaveValue(String(max));
    (slider.element() as HTMLInputElement).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(slider).toHaveValue(String(max - 1));
    await expect
      .element(slider)
      .toHaveAttribute(
        'aria-valuetext',
        expect.stringMatching(/^[\d,]+ s of [\d,]+ s since the rupture start$/),
      );
    await userEvent.keyboard('{Home}');
    await expect.element(slider).toHaveValue('0');
    await expect
      .element(slider)
      .toHaveAttribute('aria-valuetext', expect.stringMatching(/^0 s of /));
    await userEvent.keyboard('{End}');
    await expect.element(slider).toHaveValue(String(max));
    await userEvent.keyboard('{Home}');

    await userEvent.keyboard(' ');
    await expect.element(screen.getByRole('button', { name: PAUSE_NAME })).toBeVisible();
    await expect
      .poll(() => Number((slider.element() as HTMLInputElement).value), { timeout: 5_000 })
      .toBeGreaterThan(0);
    await userEvent.keyboard(' ');
    await expect.element(screen.getByRole('button', { name: PLAY_NAME })).toBeVisible();
  });

  it('shows a persistent inline note when a ShakeMap file fails, leaving the page intact', async () => {
    stubUsgs(usgsPanamaDetail, { coverage: () => new Response(null, { status: 500 }) });
    const screen = await renderVisibleSection();

    const alert = screen.getByRole('alert');
    await expect
      .element(alert.getByText("Couldn't load the ShakeMap from USGS."), { timeout: 5_000 })
      .toBeVisible();
    await expect.element(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
    for (const name of ['Key facts', 'Location details', 'Impact', 'Focal mechanism']) {
      await expect.element(screen.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    expect(screen.getByRole('slider').elements()).toHaveLength(0);
  });

  it('cleans up when the page unmounts mid-animation', async () => {
    stubUsgs(usgsPanamaDetail);
    const consoleError = vi.spyOn(console, 'error');
    const screen = await renderVisibleSection();

    const slider = screen.getByRole('slider', { name: SLIDER_NAME });
    await expect
      .poll(() => Number((slider.element() as HTMLInputElement).value), { timeout: 5_000 })
      .toBeGreaterThan(0);
    await screen.unmount();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(consoleError).not.toHaveBeenCalled();
  });
});
