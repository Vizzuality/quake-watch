import {
  type EarthquakeSearch,
  type Interval,
  type TimeFilters,
  getDateStart,
} from '@/lib/earthquakes/search-schema';
import { getIntlLocale } from '@/lib/i18n/intl-locale';
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
  '1y': m.interval_1y,
  custom: m.interval_custom,
};

const RANGE_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
};

export function getRangeDateLabel(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), RANGE_DATE_OPTIONS).format(
    getDateStart(date),
  );
}

export function getRangeInputs(
  { from = '', to = '' }: TimeFilters,
  locale: Locale,
): { from: string; to: string } {
  return { from: getRangeDateLabel(from, locale), to: getRangeDateLabel(to, locale) };
}

export function getIntervalLabel(interval: Interval, locale: Locale): string {
  return INTERVAL_LABELS[interval]({}, { locale });
}

export function getPlaceLabel(search: EarthquakeSearch, locale: Locale): string {
  return search.place ?? m.place_my_location({}, { locale });
}
