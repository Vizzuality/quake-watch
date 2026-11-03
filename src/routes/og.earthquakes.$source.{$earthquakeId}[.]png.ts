import { createFileRoute } from '@tanstack/react-router';
import { createElement } from 'react';

import { SERVER_FETCH_TIMEOUT_MS } from '@/lib/earthquakes/details/detail-fetch-policy';
import { getEmscEarthquakeDetail } from '@/lib/earthquakes/details/emsc';
import { getUsgsEarthquakeDetail } from '@/lib/earthquakes/details/usgs';
import type { Earthquake } from '@/lib/earthquakes/types';
import { getSiteUrl } from '@/lib/seo/site-url';
import { getLocale } from '@/paraglide/runtime';
import { getShareCardPng, getShareCardResponse } from '@/server/og/render-share-card';
import { EarthquakeShareCard } from '@/server/og/share-card';

type DetailFetcher = (
  id: string,
  signal: AbortSignal,
) => Promise<{ earthquake: Earthquake } | null>;

const MAX_AGE_SECONDS = 3600;

const DETAIL_FETCHERS: Partial<Record<string, DetailFetcher>> = {
  usgs: getUsgsEarthquakeDetail,
  emsc: getEmscEarthquakeDetail,
};

async function getEarthquake(
  fetchDetail: DetailFetcher,
  id: string,
): Promise<Earthquake | null | 'unavailable'> {
  try {
    const detail = await fetchDetail(id, AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS));
    return detail?.earthquake ?? null;
  } catch {
    return 'unavailable';
  }
}

export const Route = createFileRoute('/og/earthquakes/$source/{$earthquakeId}.png')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const fetchDetail = DETAIL_FETCHERS[params.source];
        if (!fetchDetail) return new Response('Not found', { status: 404 });
        const earthquake = await getEarthquake(fetchDetail, params.earthquakeId);
        if (earthquake === null) return new Response('Not found', { status: 404 });
        if (earthquake === 'unavailable') {
          return new Response('Earthquake data unavailable', {
            status: 503,
            headers: { 'cache-control': 'no-store' },
          });
        }
        const card = createElement(EarthquakeShareCard, {
          earthquake,
          locale: getLocale(),
          host: new URL(getSiteUrl()).host,
        });
        return getShareCardResponse(await getShareCardPng(card), MAX_AGE_SECONDS);
      },
    },
  },
});
