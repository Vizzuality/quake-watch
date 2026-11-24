import { defaultStringifySearch } from '@tanstack/react-router';

import {
  EARTHQUAKE_SEARCH_DEFAULTS,
  earthquakeSearchFieldsSchema,
  MIN_MAGNITUDES,
} from '@/lib/earthquakes/search-schema';

const LEGACY_MAP_PATH = /^\/(en|es)\/map\/?$/;
const LEGACY_DETAIL_PATH = /^\/(en|es)\/earthquakes\/(emsc|usgs)\/([^/]+)\/?$/;

const LEGACY_PERIOD_INTERVALS: Record<string, string> = {
  '24h': '24h',
  '7d': '7d',
  '30d': '7d',
  '1y': '1y',
};

type MappedKey = 'source' | 'place' | 'plat' | 'plon' | 'radius' | 'interval' | 'minmag';

function getMinMagnitudeStep(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return MIN_MAGNITUDES.findLast((step) => step <= value);
}

function getFiniteNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function getRouterParsedValue(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function getCanonicalValue(key: MappedKey, value: unknown): unknown {
  if (value === undefined) return undefined;
  const result = earthquakeSearchFieldsSchema.shape[key].safeParse(value);
  if (!result.success) return undefined;
  const defaults: Record<string, unknown> = EARTHQUAKE_SEARCH_DEFAULTS;
  if (defaults[key] === result.data) return undefined;
  return result.data;
}

function getAreaMappedSearch(mapped: Record<string, unknown>): Record<string, unknown> {
  if (mapped.plat !== undefined && mapped.plon !== undefined) return mapped;
  const { place: _place, plat: _plat, plon: _plon, radius: _radius, ...rest } = mapped;
  return rest;
}

function getMappedMapSearch(params: URLSearchParams): string {
  const period = params.get('period');
  const candidates: Record<MappedKey, unknown> = {
    source: getRouterParsedValue(params.get('source')),
    place: getRouterParsedValue(params.get('place')),
    plat: getFiniteNumber(params.get('lat')),
    plon: getFiniteNumber(params.get('lon')),
    radius: getFiniteNumber(params.get('radius')),
    interval: period === null ? undefined : LEGACY_PERIOD_INTERVALS[period],
    minmag: getMinMagnitudeStep(params.get('minmag')),
  };
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidates)) {
    const canonical = getCanonicalValue(key as MappedKey, value);
    if (canonical !== undefined) mapped[key] = canonical;
  }
  return defaultStringifySearch(getAreaMappedSearch(mapped));
}

export function getLegacyRedirect(url: URL): string | null {
  const map = LEGACY_MAP_PATH.exec(url.pathname);
  if (map) return `/${map[1]}${getMappedMapSearch(url.searchParams)}`;

  const detail = LEGACY_DETAIL_PATH.exec(url.pathname);
  if (detail) return `/${detail[1]}?quake=${detail[2]}:${encodeURIComponent(detail[3])}`;

  return null;
}
