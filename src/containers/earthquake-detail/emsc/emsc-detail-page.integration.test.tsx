import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CrustCell } from '@/lib/crust/types';
import { getEmscDetailFeature } from '@/test/fixtures/emsc-detail';
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

const ID = '20261013_0000326';

const CELL: CrustCell = {
  latitude: -5.5,
  longitude: 152.5,
  boundaryElevationsKm: [0.8, 0.8, 0.8, -0.2, -2.0, -2.0, -11.83, -21.65, -31.77],
};

function stubEmsc(respond: () => Response) {
  return stubFetch([
    {
      match: (url) =>
        url.hostname === 'www.seismicportal.eu' && url.searchParams.get('eventid') === ID,
      respond,
    },
    { match: () => true, respond: () => new Response(null, { status: 404 }) },
  ]);
}

async function renderPage() {
  return renderWithRouter(() => <EmscDetailPage earthquakeId={ID} />, `/earthquakes/emsc/${ID}`);
}

describe('EmscDetailPage', () => {
  beforeEach(() => {
    mocks.getCrustCells.mockReset();
    mocks.getCrustCells.mockResolvedValue([CELL]);
  });

  it('shows the header, key facts, crustal block and origin details', async () => {
    stubEmsc(() => Response.json(getEmscDetailFeature()));
    const { screen } = await renderPage();

    await expect
      .element(screen.getByRole('heading', { level: 1, name: /New Britain/i }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: /View on EMSC/ }))
      .toHaveAttribute('href', `https://www.seismicportal.eu/eventdetails.html?unid=${ID}`);
    await expect.element(screen.getByText('28.4 km').first()).toBeVisible();
    for (const name of ['Key facts', 'Crustal block', 'Location details']) {
      await expect.element(screen.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await expect.element(screen.getByText('NEIC')).toBeVisible();
    await expect.element(screen.getByText('EMSC-RTS')).toBeVisible();
    await expect.element(screen.getByText('NEW BRITAIN REGION, P.N.G.').first()).toBeVisible();
    await expect.element(screen.getByText('Last updated')).toBeVisible();
  });

  it('hides the origin section when EMSC provides none of its fields', async () => {
    const feature = getEmscDetailFeature();
    const optional = new Set(['auth', 'source_catalog', 'flynn_region', 'lastupdate']);
    const properties = Object.fromEntries(
      Object.entries(feature.properties).filter(([key]) => !optional.has(key)),
    );
    stubEmsc(() => Response.json({ ...feature, properties }));
    const { screen } = await renderPage();

    await expect
      .element(screen.getByRole('heading', { level: 2, name: 'Key facts' }))
      .toBeVisible();
    expect(screen.getByRole('heading', { name: 'Location details' }).elements()).toHaveLength(0);
  });

  it('explains a datum on demand with the keyboard', async () => {
    stubEmsc(() => Response.json(getEmscDetailFeature()));
    const { screen } = await renderPage();

    const toggle = screen.getByRole('button', { name: 'Explain Seismic region' });
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
    (toggle.element() as HTMLElement).focus();
    await toggle.click();
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect.element(screen.getByText(/Flynn–Engdahl regionalization/)).toBeVisible();
  });

  it('shows an inline not-found state with a way back', async () => {
    stubEmsc(() => new Response(null, { status: 204 }));
    const { screen } = await renderPage();

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
    stubEmsc(() => {
      attempts += 1;
      return attempts <= 2
        ? new Response(null, { status: 503 })
        : Response.json(getEmscDetailFeature());
    });
    const { screen } = await renderPage();

    await expect.element(screen.getByRole('alert')).toBeVisible();
    await expect.element(screen.getByText(/reach EMSC/)).toBeVisible();
    await screen.getByRole('button', { name: 'Retry' }).click();
    await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
