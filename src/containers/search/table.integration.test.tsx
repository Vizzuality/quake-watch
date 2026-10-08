import { describe, expect, it } from 'vitest';

import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { SearchTable } from './table';

function getFeatures(count: number) {
  return Array.from({ length: count }, (_, index) =>
    getEmscFeature({
      id: `e${index}`,
      mag: 2.5 + (index % 40) / 10,
      time: new Date(Date.UTC(2026, 7, 1) + index * 60_000).toISOString(),
      region: `REGION ${index}`,
    }),
  );
}

function stubEmsc(...responses: (() => Response)[]) {
  let call = 0;
  return stubFetch([
    {
      match: (url) => url.hostname === 'www.seismicportal.eu',
      respond: () => responses[Math.min(call++, responses.length - 1)]!(),
    },
  ]);
}

describe('SearchTable', () => {
  it('lists earthquakes newest first', async () => {
    stubEmsc(() => Response.json(getFeatureCollection(getFeatures(3))));
    const { screen } = await renderWithRouter(SearchTable, '/?period=1y');
    await expect.element(screen.getByRole('row').nth(1)).toMatchTextContent('Region 2');
  });

  it('shows skeleton cards while loading', async () => {
    stubFetch([
      {
        match: (url) => url.hostname === 'www.seismicportal.eu',
        respond: () => new Promise<Response>(() => {}),
      },
    ]);
    const { screen } = await renderWithRouter(SearchTable, '/?period=1y');
    await expect.poll(() => screen.getByTestId('card-skeleton').elements().length).toBe(8);
  });

  it('sorts by magnitude and writes it to the URL', async () => {
    stubEmsc(() => Response.json(getFeatureCollection(getFeatures(3))));
    const { screen, router } = await renderWithRouter(SearchTable, '/?period=1y');
    await screen.getByRole('button', { name: 'Magnitude' }).click();
    await expect.poll(() => router.state.location.search).toMatchObject({ sort: 'magnitude.desc' });
    await expect.element(screen.getByRole('row').nth(1)).toMatchTextContent('2.7');
  });

  it('paginates 50 rows at a time and clamps an out-of-range page', async () => {
    stubEmsc(() => Response.json(getFeatureCollection(getFeatures(120))));
    const { screen } = await renderWithRouter(SearchTable, '/?period=1y&page=9');
    await expect.element(screen.getByText('Page 3 of 3')).toBeVisible();
    expect(screen.getByRole('row').elements()).toHaveLength(21);
    await screen.getByRole('button', { name: 'Previous' }).click();
    await expect.element(screen.getByText('Page 2 of 3')).toBeVisible();
    expect(screen.getByRole('row').elements()).toHaveLength(51);
  });

  it('shows an inline error and recovers on retry', async () => {
    stubEmsc(
      () => new Response(null, { status: 503 }),
      () => Response.json(getFeatureCollection(getFeatures(1))),
    );
    const { screen } = await renderWithRouter(SearchTable, '/?period=1y');
    await expect.element(screen.getByRole('alert')).toMatchTextContent("Couldn't reach EMSC.");
    await screen.getByRole('button', { name: 'Retry' }).click();
    await expect.element(screen.getByRole('cell', { name: 'Region 0' })).toBeVisible();
  });

  it('offers to widen an empty search', async () => {
    stubEmsc(() => new Response(null, { status: 204 }));
    const { screen, router } = await renderWithRouter(
      SearchTable,
      '/?place=Granada&lat=37.17&lon=-3.6&period=7d',
    );
    await expect.element(screen.getByText('No earthquakes match these filters')).toBeVisible();
    await screen.getByRole('button', { name: 'Widen radius to 250 km' }).click();
    await expect.poll(() => router.state.location.search).toMatchObject({ radius: 250 });
    await expect
      .element(screen.getByRole('button', { name: 'Widen to last 30 days' }))
      .toBeVisible();
  });

  it('warns when the result hit the limit', async () => {
    stubEmsc(() => Response.json(getFeatureCollection(getFeatures(1000))));
    const { screen } = await renderWithRouter(SearchTable, '/?period=1y');
    await expect.element(screen.getByText(/Showing the 1,000 most recent/)).toBeVisible();
  });
});
