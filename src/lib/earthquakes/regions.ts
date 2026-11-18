import { REGION_ALIASES } from './region-aliases';
import type { Earthquake } from './types';

export const REGION_SUGGESTION_LIMIT = 6;

const DISTANCE_PREFIX = /^\d+(?:\.\d+)?\s*km\s+[NSEW]{1,3}\s+of\s+/i;
const DIRECTION_PREFIX =
  /^(?:(?:near|off)\s+(?:the\s+)?(?:(?:north|south|east|west|[ns]\.?[ew]|[nsew])\.?(?:ern)?\s+)?coast\s+of|(?:north|south|east|west|northeast|northwest|southeast|southwest)\s+of)\s+(?:the\s+)?/i;
const ISLAND_PREFIX = /^(?:north|south)\s+island\s+of\s+/i;
const REGION_SUFFIX = /\s+(?:region|reg\.?)$/i;
const ISLANDS_ABBREVIATION = /\bIs\.(?=[\s-]|$)/g;

export type RegionSuggestion = { name: string; count: number };

export function getEarthquakeRegion(place: string | null): string | null {
  const segment = place?.split(',').at(-1)?.trim();
  if (!segment) return null;
  const region = segment
    .replace(DISTANCE_PREFIX, '')
    .replace(DIRECTION_PREFIX, '')
    .replace(ISLAND_PREFIX, '')
    .replace(REGION_SUFFIX, '')
    .replace(ISLANDS_ABBREVIATION, 'Islands')
    .trim();
  if (!region) return null;
  return REGION_ALIASES.get(region.toLowerCase()) ?? region;
}

export function getRegionKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function getRegionCounts(earthquakes: readonly Earthquake[]): Map<string, RegionSuggestion> {
  const counts = new Map<string, RegionSuggestion>();
  for (const earthquake of earthquakes) {
    const name = getEarthquakeRegion(earthquake.place);
    if (!name) continue;
    const key = getRegionKey(name);
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { name, count: 1 });
  }
  return counts;
}

function getSuggestionRank(key: string, query: string): number {
  return key.startsWith(query) ? 0 : 1;
}

export function getRegionSuggestions(
  earthquakes: readonly Earthquake[],
  text: string,
  limit = REGION_SUGGESTION_LIMIT,
): RegionSuggestion[] {
  const query = getRegionKey(text);
  if (!query) return [];
  return [...getRegionCounts(earthquakes)]
    .filter(([key]) => key.includes(query))
    .sort(
      ([keyA, a], [keyB, b]) =>
        getSuggestionRank(keyA, query) - getSuggestionRank(keyB, query) ||
        b.count - a.count ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map(([, suggestion]) => suggestion);
}

export function getRegionEarthquakes(
  earthquakes: readonly Earthquake[],
  place: string,
): Earthquake[] {
  const key = getRegionKey(place);
  return earthquakes.filter((earthquake) => {
    const region = getEarthquakeRegion(earthquake.place);
    return region !== null && getRegionKey(region) === key;
  });
}
