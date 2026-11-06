import type { EarthquakeSearch, Interval } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

type MessageOptions = { locale: Locale };

const INTERVAL_LABELS: Record<
  Interval,
  (inputs: Record<string, never>, options: MessageOptions) => string
> = {
  '24h': m.interval_24h,
  '3d': m.interval_3d,
  '7d': m.interval_7d,
};

export function getIntervalLabel(interval: Interval, locale: Locale): string {
  return INTERVAL_LABELS[interval]({}, { locale });
}

export function getPlaceLabel(search: EarthquakeSearch, locale: Locale): string {
  return search.place ?? m.place_my_location({}, { locale });
}
