import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { SearchLayout } from './layout';

const GRANADA = '/?place=Granada&lat=37.17&lon=-3.6&period=1y';

function stubEmsc() {
  stubFetch([
    {
      match: (url) => url.hostname === 'www.seismicportal.eu',
      respond: () => Response.json(getFeatureCollection([getEmscFeature()])),
    },
  ]);
}

describe('SearchLayout', () => {
  it('summarises the search', async () => {
    stubEmsc();
    const { screen } = await renderWithRouter(SearchLayout, GRANADA);
    await expect
      .element(screen.getByText('1 earthquake within 100 km of Granada', { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByText(/^last year · EMSC · updated \d{1,2}:\d{2}/))
      .toBeVisible();
  });

  it('hides the previous count while the new catalogue loads', async () => {
    stubFetch([
      {
        match: (url) => url.hostname === 'www.seismicportal.eu',
        respond: () => Response.json(getFeatureCollection([getEmscFeature()])),
      },
      {
        match: (url) => url.hostname === 'earthquake.usgs.gov',
        respond: () => new Promise<Response>(() => {}),
      },
    ]);
    const { screen, router } = await renderWithRouter(SearchLayout, GRANADA);
    await expect.element(screen.getByText('1 earthquake within 100 km of Granada')).toBeVisible();
    await router.navigate({ to: '/', search: (prev) => ({ ...prev, source: 'usgs' }) });
    await expect.element(screen.getByText('Loading earthquakes…')).toBeVisible();
    await expect.element(screen.getByText(/1 earthquake/)).not.toBeInTheDocument();
    expect(screen.getByRole('table').element().closest('section')?.getAttribute('aria-busy')).toBe(
      'true',
    );
  });

  it('keeps the search when switching view or language', async () => {
    stubEmsc();
    const { screen } = await renderWithRouter(SearchLayout, GRANADA);
    const mapHref = screen.getByRole('link', { name: 'Map' }).element().getAttribute('href') ?? '';
    const spanishHref =
      screen.getByRole('link', { name: 'ES' }).element().getAttribute('href') ?? '';
    expect(new URL(mapHref, location.origin).searchParams.get('place')).toBe('Granada');
    expect(new URL(spanishHref, location.origin).pathname).toBe('/es');
    expect(new URL(spanishHref, location.origin).searchParams.get('place')).toBe('Granada');
  });

  it('shows cards and a filter sheet on a phone', async () => {
    await page.viewport(375, 812);
    stubEmsc();
    const { screen } = await renderWithRouter(SearchLayout, GRANADA);
    await expect
      .element(screen.getByRole('list', { name: 'Earthquakes matching the current filters' }))
      .toBeVisible();
    await expect.element(screen.getByRole('table')).not.toBeInTheDocument();
    await screen.getByRole('button', { name: /Filters/ }).click();
    await expect.element(screen.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    await page.viewport(1280, 800);
  });
});
