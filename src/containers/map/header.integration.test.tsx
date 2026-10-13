import { describe, expect, it } from 'vitest';

import { getEmscFeature, getFeatureCollection } from '@/test/fixtures/earthquakes';
import { renderWithRouter } from '@/test/render-with-router';
import { stubFetch } from '@/test/stub-fetch';

import { MapHeader } from './header';

function getFeatures(count: number) {
  return Array.from({ length: count }, (_, index) =>
    getEmscFeature({
      id: `e${index}`,
      time: new Date(Date.UTC(2026, 7, 1) + index * 60_000).toISOString(),
      region: `REGION ${index}`,
    }),
  );
}

function stubEmsc(count: number) {
  stubFetch([
    {
      match: (url) => url.hostname === 'www.seismicportal.eu',
      respond: () => Response.json(getFeatureCollection(getFeatures(count))),
    },
  ]);
}

describe('MapHeader', () => {
  it('warns that only the most recent are shown when the result hit the limit', async () => {
    stubEmsc(1000);
    const { screen } = await renderWithRouter(MapHeader, '/?period=1y');
    await expect
      .element(screen.getByText(/Showing only the 1,000 most recent, in the table and on the map/))
      .toBeVisible();
  });

  it('shows no notice below the limit', async () => {
    stubEmsc(3);
    const { screen } = await renderWithRouter(MapHeader, '/?period=1y');
    await expect.element(screen.getByText(/3 earthquakes/)).toBeVisible();
    await expect.element(screen.getByText(/Showing only/)).not.toBeInTheDocument();
  });
});
