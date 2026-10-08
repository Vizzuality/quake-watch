import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { Filters } from './filters';

function FiltersUnderTest() {
  return <Filters idPrefix="test" />;
}

describe('Filters', () => {
  it('disables the radius until a place is set', async () => {
    const { screen } = await renderWithRouter(FiltersUnderTest);
    await expect.element(screen.getByLabelText('Radius')).toBeDisabled();
  });

  it('shows date inputs for a custom period and writes them to the URL', async () => {
    const { screen, router } = await renderWithRouter(FiltersUnderTest);
    await userEvent.selectOptions(screen.getByLabelText('Period'), 'custom');
    await userEvent.fill(screen.getByLabelText('From'), '2026-08-14');
    await expect
      .poll(() => router.state.location.search)
      .toMatchObject({ period: 'custom', from: '2026-08-14' });
  });

  it('switches the catalogue', async () => {
    const { screen, router } = await renderWithRouter(FiltersUnderTest);
    await screen.getByRole('button', { name: 'USGS' }).click();
    await expect.poll(() => router.state.location.search).toMatchObject({ source: 'usgs' });
  });

  it('clears filters but keeps the catalogue', async () => {
    const { screen, router } = await renderWithRouter(
      FiltersUnderTest,
      '/?source=usgs&place=Granada&lat=37.17&lon=-3.6&radius=250&period=1y&minmag=4',
    );
    await screen.getByRole('button', { name: 'Clear filters' }).click();
    await expect
      .poll(() => router.state.location.search)
      .toMatchObject({ source: 'usgs', radius: 100, period: '24h', minmag: 2.5 });
    expect(router.state.location.search).not.toHaveProperty('place');
  });

  it('keeps the other filters usable when location permission is denied', async () => {
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation((_success, error) =>
      error?.({ code: 1 } as GeolocationPositionError),
    );
    const { screen, router } = await renderWithRouter(FiltersUnderTest);
    await screen.getByRole('button', { name: 'Use my location' }).click();
    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('Location permission was denied.');
    await userEvent.selectOptions(screen.getByLabelText('Min. magnitude'), '4');
    await expect.poll(() => router.state.location.search).toMatchObject({ minmag: 4 });
  });

  it('keeps the other filters usable when place search is down', async () => {
    stubFetch([
      {
        match: (url) => url.hostname === 'photon.komoot.io',
        respond: () => new Response(null, { status: 503 }),
      },
    ]);
    const { screen, router } = await renderWithRouter(FiltersUnderTest);
    await userEvent.type(screen.getByLabelText('Place'), 'granada');
    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('Place search is unavailable right now');
    await userEvent.selectOptions(screen.getByLabelText('Period'), '7d');
    await expect.poll(() => router.state.location.search).toMatchObject({ period: '7d' });
  });
});
