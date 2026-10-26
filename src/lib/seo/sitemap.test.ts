import { beforeEach, describe, expect, it } from 'vitest';

import { getEmscFeature, getFeatureCollection, getUsgsFeature } from '@/test/fixtures/earthquakes';
import { stubFetch } from '@/test/stub-fetch';

import { getSitemap, getSitemapXml, resetSitemapCache } from './sitemap';

const ORIGIN = 'https://quake-watch.up.railway.app';
const NOW = new Date('2026-10-26T12:00:00Z');
const TTL_MS = 15 * 60_000;

beforeEach(() => {
  resetSitemapCache();
});

function getUrlBlocks(xml: string): string[] {
  return xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
}

function getBlockFor(xml: string, loc: string): string | undefined {
  return getUrlBlocks(xml).find((block) => block.includes(`<loc>${loc}</loc>`));
}

function getUsgsFeatureWithUpdate(id: string, updated: number | undefined) {
  const feature = getUsgsFeature({ id });
  return { ...feature, properties: { ...feature.properties, updated } };
}

function getEmscFeatureWithUpdate(id: string, lastupdate: string | undefined) {
  const feature = getEmscFeature({ id });
  return { ...feature, properties: { ...feature.properties, lastupdate } };
}

function getJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

function stubCatalogues({ isUsgsDown = false } = {}) {
  return stubFetch([
    {
      match: (url) => url.hostname === 'earthquake.usgs.gov',
      respond: () =>
        isUsgsDown
          ? new Response('boom', { status: 503 })
          : getJsonResponse(getFeatureCollection([getUsgsFeature({ id: 'us1' })])),
    },
    {
      match: (url) => url.hostname === 'www.seismicportal.eu',
      respond: () => getJsonResponse(getFeatureCollection([getEmscFeature({ id: 'e1' })])),
    },
  ]);
}

describe('getSitemapXml', () => {
  it('declares the sitemap and xhtml namespaces', () => {
    const xml = getSitemapXml([{ pathname: '/' }]);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    );
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('emits an en and an es url per page, each with three hreflang alternates', () => {
    const xml = getSitemapXml([{ pathname: '/map' }]);
    const alternates = [
      `<xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/en/map"/>`,
      `<xhtml:link rel="alternate" hreflang="es" href="${ORIGIN}/es/map"/>`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/en/map"/>`,
    ];

    expect(getUrlBlocks(xml)).toHaveLength(2);
    for (const loc of [`${ORIGIN}/en/map`, `${ORIGIN}/es/map`]) {
      const block = getBlockFor(xml, loc);
      for (const alternate of alternates) expect(block).toContain(alternate);
    }
  });

  it('writes lastmod as ISO 8601 when present and omits it otherwise', () => {
    const xml = getSitemapXml([
      { pathname: '/' },
      { pathname: '/earthquakes/usgs/us1', lastmod: Date.parse('2026-10-20T10:00:00Z') },
    ]);

    expect(getBlockFor(xml, `${ORIGIN}/en`)).not.toContain('<lastmod>');
    expect(getBlockFor(xml, `${ORIGIN}/es/earthquakes/usgs/us1`)).toContain(
      '<lastmod>2026-10-20T10:00:00.000Z</lastmod>',
    );
  });

  it('escapes XML special characters in urls', () => {
    const xml = getSitemapXml([{ pathname: '/earthquakes/emsc/a&b\'<c>"' }]);

    expect(xml).toContain('a&amp;b&apos;');
    expect(xml).not.toMatch(/&(?!amp;|apos;|lt;|gt;|quot;)/);
    expect(xml).not.toContain("'");
  });
});

describe('getSitemap', () => {
  it('lists static pages and events from both catalogues with their update time', async () => {
    const fetchMock = stubFetch([
      {
        match: (url) => url.hostname === 'earthquake.usgs.gov',
        respond: () =>
          getJsonResponse(
            getFeatureCollection([
              getUsgsFeatureWithUpdate('us1', Date.parse('2026-10-21T00:00:00Z')),
              getUsgsFeatureWithUpdate('us2', undefined),
              { invalid: true },
            ]),
          ),
      },
      {
        match: (url) => url.hostname === 'www.seismicportal.eu',
        respond: () =>
          getJsonResponse(
            getFeatureCollection([
              getEmscFeatureWithUpdate('20261020_0000001', '2026-10-22T01:02:03.000Z'),
              getEmscFeatureWithUpdate('20261020_0000002', undefined),
            ]),
          ),
      },
    ]);

    const xml = await getSitemap(NOW);

    expect(getUrlBlocks(xml)).toHaveLength(12);
    for (const path of ['/en', '/es', '/en/map', '/es/map']) {
      expect(getBlockFor(xml, `${ORIGIN}${path}`)).toBeDefined();
    }
    expect(getBlockFor(xml, `${ORIGIN}/en/earthquakes/usgs/us1`)).toContain(
      '<lastmod>2026-10-21T00:00:00.000Z</lastmod>',
    );
    expect(getBlockFor(xml, `${ORIGIN}/es/earthquakes/usgs/us2`)).toContain(
      `<lastmod>${new Date(getUsgsFeature().properties.time).toISOString()}</lastmod>`,
    );
    expect(getBlockFor(xml, `${ORIGIN}/es/earthquakes/emsc/20261020_0000001`)).toContain(
      '<lastmod>2026-10-22T01:02:03.000Z</lastmod>',
    );
    expect(getBlockFor(xml, `${ORIGIN}/en/earthquakes/emsc/20261020_0000002`)).toContain(
      '<lastmod>2026-08-14T23:04:40.180Z</lastmod>',
    );

    const [usgsUrl, emscUrl] = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(usgsUrl?.searchParams.get('minmagnitude')).toBe('4.5');
    expect(usgsUrl?.searchParams.get('starttime')).toBe('2026-09-26T12:00:00.000Z');
    expect(emscUrl?.searchParams.get('minmag')).toBe('4.5');
    expect(emscUrl?.searchParams.get('start')).toBe('2026-09-26T12:00:00.000Z');
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('still serves static pages and the other catalogue when one fails', async () => {
    stubFetch([
      {
        match: (url) => url.hostname === 'earthquake.usgs.gov',
        respond: () => new Response('boom', { status: 503 }),
      },
      {
        match: (url) => url.hostname === 'www.seismicportal.eu',
        respond: () => getJsonResponse(getFeatureCollection([getEmscFeature({ id: 'e1' })])),
      },
    ]);

    const xml = await getSitemap(NOW);

    expect(getUrlBlocks(xml)).toHaveLength(6);
    expect(getBlockFor(xml, `${ORIGIN}/es/map`)).toBeDefined();
    expect(getBlockFor(xml, `${ORIGIN}/en/earthquakes/emsc/e1`)).toBeDefined();
    expect(xml).not.toContain('/earthquakes/usgs/');
  });

  it('keeps an event whose update and event times are outside the Date range', async () => {
    stubFetch([
      {
        match: (url) => url.hostname === 'earthquake.usgs.gov',
        respond: () =>
          getJsonResponse(
            getFeatureCollection([
              getUsgsFeatureWithUpdate('us1', 1e16),
              {
                ...getUsgsFeatureWithUpdate('us2', 1e16),
                properties: { ...getUsgsFeatureWithUpdate('us2', 1e16).properties, time: 1e16 },
              },
            ]),
          ),
      },
      {
        match: (url) => url.hostname === 'www.seismicportal.eu',
        respond: () => getJsonResponse(getFeatureCollection([])),
      },
    ]);

    const xml = await getSitemap(NOW);

    expect(getBlockFor(xml, `${ORIGIN}/en/earthquakes/usgs/us1`)).toContain(
      `<lastmod>${new Date(getUsgsFeature().properties.time).toISOString()}</lastmod>`,
    );
    expect(getBlockFor(xml, `${ORIGIN}/en/earthquakes/usgs/us2`)).not.toContain('<lastmod>');
  });

  it('serves only static pages when both catalogues reject', async () => {
    stubFetch([]);

    const xml = await getSitemap(NOW);

    expect(getUrlBlocks(xml)).toHaveLength(4);
  });
});

describe('getSitemap cache', () => {
  it('reuses the sitemap within 15 minutes', async () => {
    const fetchMock = stubCatalogues();

    const first = await getSitemap(NOW);
    const second = await getSitemap(new Date(NOW.getTime() + TTL_MS - 1));

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fetches again once 15 minutes have passed', async () => {
    const fetchMock = stubCatalogues();

    await getSitemap(NOW);
    await getSitemap(new Date(NOW.getTime() + TTL_MS));

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('shares one fetch pair between concurrent callers', async () => {
    const fetchMock = stubCatalogues();

    const [first, second] = await Promise.all([getSitemap(NOW), getSitemap(NOW)]);

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache a sitemap missing a catalogue', async () => {
    const fetchMock = stubCatalogues({ isUsgsDown: true });

    await getSitemap(NOW);
    await getSitemap(NOW);

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
