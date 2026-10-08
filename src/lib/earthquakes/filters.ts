import { EARTHQUAKE_FILTER_DEFAULTS, RADII_KM, getSearchCenter } from './search-schema';
import type { EarthquakeSearch, Period, RadiusKm } from './search-schema';

const WIDER_PERIODS: Record<Period, Period | null> = {
  '24h': '7d',
  '7d': '30d',
  '30d': '1y',
  '1y': null,
  custom: null,
};

export function getWiderRadius(radius: RadiusKm): RadiusKm | null {
  return RADII_KM[RADII_KM.indexOf(radius) + 1] ?? null;
}

export function getWiderPeriod(period: Period): Period | null {
  return WIDER_PERIODS[period];
}

export function getActiveFilterCount(search: EarthquakeSearch): number {
  const hasCenter = getSearchCenter(search) !== null;
  return [
    hasCenter,
    hasCenter && search.radius !== EARTHQUAKE_FILTER_DEFAULTS.radius,
    search.period !== EARTHQUAKE_FILTER_DEFAULTS.period,
    search.minmag !== EARTHQUAKE_FILTER_DEFAULTS.minmag,
  ].filter(Boolean).length;
}
