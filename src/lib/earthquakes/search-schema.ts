import { z } from 'zod';

export const SOURCES = ['emsc', 'usgs'] as const;
export const RADII_KM = [50, 100, 250, 500] as const;
export const PERIODS = ['24h', '7d', '30d', '1y', 'custom'] as const;
export const MIN_MAGNITUDES = [0, 1, 2, 2.5, 3, 4, 5, 6] as const;
const SORT_COLUMNS = ['magnitude', 'time', 'place', 'distance', 'depth', 'magnitudeType'] as const;

export type EarthquakeSource = (typeof SOURCES)[number];
export type RadiusKm = (typeof RADII_KM)[number];
export type Period = (typeof PERIODS)[number];
type SortColumn = (typeof SORT_COLUMNS)[number];
export type SearchCenter = { latitude: number; longitude: number };

export const DEFAULT_SORT = 'time.desc';
const SORT_PATTERN = new RegExp(`^(${SORT_COLUMNS.join('|')})\\.(asc|desc)$`);
const DAY_MS = 86_400_000;
const PERIOD_MS: Record<Exclude<Period, 'custom'>, number> = {
  '24h': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
  '1y': 365 * DAY_MS,
};

export const earthquakeSearchSchema = z.object({
  source: z.enum(SOURCES).default('emsc').catch('emsc'),
  place: z.string().trim().min(1).max(120).optional().catch(undefined),
  lat: z.number().min(-90).max(90).optional().catch(undefined),
  lon: z.number().min(-180).max(180).optional().catch(undefined),
  radius: z.literal(RADII_KM).default(100).catch(100),
  period: z.enum(PERIODS).default('24h').catch('24h'),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  minmag: z.literal(MIN_MAGNITUDES).default(2.5).catch(2.5),
  sort: z.string().regex(SORT_PATTERN).default(DEFAULT_SORT).catch(DEFAULT_SORT),
  page: z.int().min(1).default(1).catch(1),
});

export type EarthquakeSearch = z.infer<typeof earthquakeSearchSchema>;

export const EARTHQUAKE_SEARCH_DEFAULTS: EarthquakeSearch = earthquakeSearchSchema.parse({});

const { source: _source, sort: _sort, page: _page, ...filterDefaults } = EARTHQUAKE_SEARCH_DEFAULTS;
export const EARTHQUAKE_FILTER_DEFAULTS = filterDefaults;

export function getSearchCenter({ lat, lon }: EarthquakeSearch): SearchCenter | null {
  if (lat === undefined || lon === undefined) return null;
  return { latitude: lat, longitude: lon };
}

function getCustomRange(from: string | undefined, to: string | undefined, now: Date) {
  const [first, last] = from && to ? [from, to].sort() : [from, to];
  const end = last ? new Date(`${last}T23:59:59.999Z`) : null;
  const fallbackEndMs = Math.min(now.getTime(), end?.getTime() ?? Number.POSITIVE_INFINITY);
  const start = first ? new Date(`${first}T00:00:00.000Z`) : new Date(fallbackEndMs - DAY_MS);
  return { start, end };
}

export function getTimeRange(
  search: EarthquakeSearch,
  now: Date,
): { start: Date; end: Date | null } {
  if (search.period === 'custom') return getCustomRange(search.from, search.to, now);
  return { start: new Date(now.getTime() - PERIOD_MS[search.period]), end: null };
}

export function getSortingState(sort: string): { id: SortColumn; desc: boolean }[] {
  const [id, direction] = sort.split('.') as [SortColumn, 'asc' | 'desc'];
  return [{ id, desc: direction === 'desc' }];
}

export function getSortParam(sorting: { id: string; desc: boolean }[]): string {
  const [first] = sorting;
  if (!first) return DEFAULT_SORT;
  return `${first.id}.${first.desc ? 'desc' : 'asc'}`;
}
