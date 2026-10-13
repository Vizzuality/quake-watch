import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { getPhotonCollection } from '@/test/fixtures/places';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { PlaceSearch } from './place-search';

function PlaceSearchUnderTest() {
  return <PlaceSearch id="place" />;
}

function stubPhoton(respond: () => Response) {
  return stubFetch([{ match: (url) => url.hostname === 'photon.komoot.io', respond }]);
}

describe('PlaceSearch', () => {
  it('asks Photon once per pause and only from three characters', async () => {
    const fetchMock = stubPhoton(() => Response.json(getPhotonCollection()));
    const { screen } = await renderWithRouter(PlaceSearchUnderTest);
    await userEvent.type(screen.getByLabelText('Place'), 'gr');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Place'), 'anada');
    await expect.poll(() => fetchMock.mock.calls.length).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('writes the chosen place to the URL', async () => {
    stubPhoton(() => Response.json(getPhotonCollection()));
    const { screen, router } = await renderWithRouter(PlaceSearchUnderTest);
    await userEvent.type(screen.getByLabelText('Place'), 'granada');
    await screen.getByRole('option', { name: 'Granada, Andalucía, España' }).click();
    await expect
      .poll(() => router.state.location.search)
      .toMatchObject({ place: 'Granada', lat: 37.1773, lon: -3.5986 });
  });

  it('shows an inline error when Photon fails and keeps my location usable', async () => {
    stubPhoton(() => new Response(null, { status: 500 }));
    const { screen } = await renderWithRouter(PlaceSearchUnderTest);
    await userEvent.type(screen.getByLabelText('Place'), 'granada');
    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('Place search is unavailable right now');
    await expect.element(screen.getByRole('button', { name: 'Use my location' })).toBeEnabled();
  });

  it('uses the device location rounded to two decimals', async () => {
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation((success) =>
      success({ coords: { latitude: 37.177345, longitude: -3.598612 } } as GeolocationPosition),
    );
    const { screen, router } = await renderWithRouter(PlaceSearchUnderTest);
    await screen.getByRole('button', { name: 'Use my location' }).click();
    await expect.poll(() => router.state.location.search).toMatchObject({ lat: 37.18, lon: -3.6 });
  });

  it('explains a denied location permission inline', async () => {
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation((_success, error) =>
      error?.({ code: 1 } as GeolocationPositionError),
    );
    const { screen } = await renderWithRouter(PlaceSearchUnderTest);
    await screen.getByRole('button', { name: 'Use my location' }).click();
    await expect
      .element(screen.getByRole('alert'))
      .toMatchTextContent('Location permission was denied.');
  });
});
