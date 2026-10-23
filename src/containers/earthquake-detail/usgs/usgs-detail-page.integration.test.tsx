import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CrustCell } from '@/lib/crust/types';
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

const CELL: CrustCell = {
  latitude: 7.5,
  longitude: -80.5,
  boundaryElevationsKm: [0.8, 0.8, 0.8, -0.2, -2.0, -2.0, -11.83, -21.65, -31.77],
};

function isUsgsDetailRequest(url: URL, id: string): boolean {
  return url.hostname === 'earthquake.usgs.gov' && url.searchParams.get('eventid') === id;
}

function stubUsgs(respond: () => Response | Promise<Response>, id: string) {
  return stubFetch([
    { match: (url) => isUsgsDetailRequest(url, id), respond },
    { match: () => true, respond: () => new Response(null, { status: 404 }) },
  ]);
}

function getJson(body: unknown): Response {
  return Response.json(body);
}

async function renderPage(id: string) {
  return renderWithRouter(() => <UsgsDetailPage earthquakeId={id} />, `/earthquakes/usgs/${id}`);
}

describe('UsgsDetailPage', () => {
  beforeEach(() => {
    mocks.getCrustCells.mockReset();
    mocks.getCrustCells.mockResolvedValue([CELL]);
  });

  it('shows the header and every section for a fully described Earthquake', async () => {
    stubUsgs(() => getJson(usgsPanamaDetail), 'us6000u18k');
    const { screen } = await renderPage('us6000u18k');

    await expect
      .element(screen.getByRole('heading', { level: 1, name: /Pitaloza Arriba, Panama/ }))
      .toBeVisible();
    await expect.element(screen.getByText('7.7', { exact: true })).toBeVisible();
    await expect.element(screen.getByText('7.587° N, 80.769° W').first()).toBeVisible();
    await expect.element(screen.getByText('12.6 km').first()).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: /View on USGS/ }))
      .toHaveAttribute('href', usgsPanamaDetail.properties.url);
    const mapHref = await screen
      .getByRole('link', { name: 'See on the map' })
      .element()
      .getAttribute('href');
    const mapUrl = new URL(mapHref ?? '', 'http://localhost');
    expect(mapUrl.pathname).toBe('/map');
    expect(Object.fromEntries(mapUrl.searchParams)).toMatchObject({
      source: 'usgs',
      lat: '7.5868',
      lon: '-80.769',
      period: 'custom',
      from: '2026-10-09',
      to: '2026-10-09',
      minmag: '0',
    });

    for (const name of [
      'Key facts',
      'Crustal block',
      'Location details',
      'Impact',
      'Focal mechanism',
    ]) {
      await expect.element(screen.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await expect.element(screen.getByText('± 6.5 km')).toBeVisible();
    await expect.element(screen.getByText('Orange')).toBeVisible();
    await expect.element(screen.getByText('VIII · Severe (7.7)').first()).toBeVisible();
    await expect.element(screen.getByText('1,805')).toBeVisible();
    await expect.element(screen.getByText('3.77 × 10²⁰ N·m')).toBeVisible();
    expect(screen.getByText('Tsunami flag').elements()).toHaveLength(0);
    await expect.element(screen.getByRole('img', { name: /Beach ball/ })).toBeVisible();
    await expect.element(screen.getByText('Strike-slip').first()).toBeVisible();
  });

  it('omits the sections whose data does not exist', async () => {
    stubUsgs(() => getJson(usgsOriginOnlyDetail), 'us6000u23d');
    const { screen } = await renderPage('us6000u23d');

    await expect
      .element(screen.getByRole('heading', { level: 2, name: 'Location details' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('heading', { level: 2, name: 'Crustal block' }))
      .toBeVisible();
    expect(screen.getByRole('heading', { name: 'Impact' }).elements()).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Focal mechanism' }).elements()).toHaveLength(0);
  });

  it('explains a datum on demand with the keyboard', async () => {
    stubUsgs(() => getJson(usgsPanamaDetail), 'us6000u18k');
    const { screen } = await renderPage('us6000u18k');

    const toggle = screen.getByRole('button', { name: 'Explain Azimuthal gap' });
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
    (toggle.element() as HTMLElement).focus();
    await toggle.click();
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect.element(screen.getByText(/largest angle around the Epicenter/)).toBeVisible();
  });

  it('opens the section explainer', async () => {
    stubUsgs(() => getJson(usgsPanamaDetail), 'us6000u18k');
    const { screen } = await renderPage('us6000u18k');

    await expect.element(screen.getByRole('heading', { name: 'Impact' })).toBeVisible();
    await screen.getByRole('region', { name: 'Impact' }).getByText('What does this mean?').click();
    await expect.element(screen.getByText(/Shaking is described with Intensity/)).toBeVisible();
  });

  it('shows an inline not-found state with a way back', async () => {
    stubUsgs(() => new Response(null, { status: 404 }), 'nope_123');
    const { screen } = await renderPage('nope_123');

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Earthquake not found' }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Back to all Earthquakes' }).first())
      .toHaveAttribute('href', '/');
    expect(screen.getByRole('alert').elements()).toHaveLength(0);
  });

  it('shows a persistent inline error that can be retried', async () => {
    let attempts = 0;
    stubUsgs(() => {
      attempts += 1;
      return attempts <= 2 ? new Response(null, { status: 503 }) : getJson(usgsPanamaDetail);
    }, 'us6000u18k');
    const { screen } = await renderPage('us6000u18k');

    await expect.element(screen.getByRole('alert')).toBeVisible();
    await expect.element(screen.getByText(/reach USGS/)).toBeVisible();
    await screen.getByRole('button', { name: 'Retry' }).click();
    await expect
      .element(screen.getByRole('heading', { level: 1, name: /Pitaloza Arriba/ }))
      .toBeVisible();
  });
});
