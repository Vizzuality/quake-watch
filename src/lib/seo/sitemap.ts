import { getEarthquakeDetailLinkOptions } from '@/lib/earthquakes/detail-link';
import { EMSC_QUERY_URL, emscAdapter } from '@/lib/earthquakes/sources/emsc';
import { getFeatures } from '@/lib/earthquakes/sources/feature-collection';
import type { SourceAdapter } from '@/lib/earthquakes/sources/feature-collection';
import { usgsAdapter } from '@/lib/earthquakes/sources/usgs';
import type { Earthquake } from '@/lib/earthquakes/types';

import { getAlternateLinks } from './alternate-links';

export type SitemapEntry = { pathname: string; lastmod?: number };

const USGS_QUERY_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const STATIC_PATHNAMES = ['/', '/map'];
const MIN_MAGNITUDE = '4.5';
const WINDOW_MS = 30 * 86_400_000;
const MAX_EVENTS_PER_CATALOGUE = 1000;
const FETCH_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 15 * 60_000;

let cached: { xml: string; expiresAt: number } | null = null;
let inFlight: Promise<string> | null = null;

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

type Catalogue = {
  adapter: SourceAdapter;
  getQueryUrl(start: Date): string;
  getUpdatedTime(feature: unknown): number | undefined;
};

function getEscapedXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
}

function getProperty(feature: unknown, key: string): unknown {
  if (typeof feature !== 'object' || feature === null || !('properties' in feature)) {
    return undefined;
  }
  const { properties } = feature;
  if (typeof properties !== 'object' || properties === null) return undefined;
  return (properties as Record<string, unknown>)[key];
}

function getUsgsUpdatedTime(feature: unknown): number | undefined {
  const updated = getProperty(feature, 'updated');
  return typeof updated === 'number' ? updated : undefined;
}

function getEmscUpdatedTime(feature: unknown): number | undefined {
  const lastupdate = getProperty(feature, 'lastupdate');
  if (typeof lastupdate !== 'string') return undefined;
  const time = Date.parse(lastupdate);
  return Number.isNaN(time) ? undefined : time;
}

const CATALOGUES: Catalogue[] = [
  {
    adapter: usgsAdapter,
    getQueryUrl: (start) =>
      `${USGS_QUERY_URL}?${new URLSearchParams({
        format: 'geojson',
        orderby: 'time',
        limit: String(MAX_EVENTS_PER_CATALOGUE),
        minmagnitude: MIN_MAGNITUDE,
        starttime: start.toISOString(),
      })}`,
    getUpdatedTime: getUsgsUpdatedTime,
  },
  {
    adapter: emscAdapter,
    getQueryUrl: (start) =>
      `${EMSC_QUERY_URL}?${new URLSearchParams({
        format: 'json',
        orderby: 'time',
        limit: String(MAX_EVENTS_PER_CATALOGUE),
        minmag: MIN_MAGNITUDE,
        start: start.toISOString(),
      })}`,
    getUpdatedTime: getEmscUpdatedTime,
  },
];

function isValidTime(time: number | undefined): time is number {
  return time !== undefined && !Number.isNaN(new Date(time).getTime());
}

function getEarthquakePathname(earthquake: Pick<Earthquake, 'id' | 'source'>): string {
  const { to } = getEarthquakeDetailLinkOptions(earthquake);
  return to.replace('$earthquakeId', encodeURIComponent(earthquake.id));
}

async function getCatalogueEntries(catalogue: Catalogue, now: Date): Promise<SitemapEntry[]> {
  const start = new Date(now.getTime() - WINDOW_MS);
  const response = await fetch(catalogue.getQueryUrl(start), {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${catalogue.adapter.label} responded ${response.status}`);
  const entries: SitemapEntry[] = [];
  for (const feature of getFeatures(await response.json()).slice(0, MAX_EVENTS_PER_CATALOGUE)) {
    const earthquake = catalogue.adapter.getEarthquake(feature);
    if (!earthquake) continue;
    entries.push({
      pathname: getEarthquakePathname(earthquake),
      lastmod: [catalogue.getUpdatedTime(feature), earthquake.time].find(isValidTime),
    });
  }
  return entries;
}

function getUrlXml(loc: string, lastmod: number | undefined, alternatesXml: string): string {
  const lastmodXml =
    lastmod === undefined ? '' : `<lastmod>${new Date(lastmod).toISOString()}</lastmod>`;
  return `<url><loc>${getEscapedXml(loc)}</loc>${lastmodXml}${alternatesXml}</url>`;
}

function getEntryXml({ pathname, lastmod }: SitemapEntry): string {
  const { alternates } = getAlternateLinks({ pathname, search: {} });
  const alternatesXml = alternates
    .map(
      ({ hreflang, href }) =>
        `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${getEscapedXml(href)}"/>`,
    )
    .join('');
  return alternates
    .filter(({ hreflang }) => hreflang !== 'x-default')
    .map(({ href }) => getUrlXml(href, lastmod, alternatesXml))
    .join('\n');
}

export function getSitemapXml(entries: SitemapEntry[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map(getEntryXml),
    '</urlset>',
    '',
  ].join('\n');
}

async function getFreshSitemap(now: Date): Promise<string> {
  const results = await Promise.allSettled(
    CATALOGUES.map((catalogue) => getCatalogueEntries(catalogue, now)),
  );
  const eventEntries = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  );
  const xml = getSitemapXml([
    ...STATIC_PATHNAMES.map((pathname) => ({ pathname })),
    ...eventEntries,
  ]);
  if (results.every(({ status }) => status === 'fulfilled')) {
    cached = { xml, expiresAt: now.getTime() + CACHE_TTL_MS };
  }
  return xml;
}

export function resetSitemapCache(): void {
  cached = null;
  inFlight = null;
}

export function getSitemap(now = new Date()): Promise<string> {
  if (cached && now.getTime() < cached.expiresAt) return Promise.resolve(cached.xml);
  inFlight ??= getFreshSitemap(now).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
