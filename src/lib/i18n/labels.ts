import { getTimeRange } from '@/lib/earthquakes/search-schema';
import type { EarthquakeSearch, Period } from '@/lib/earthquakes/search-schema';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

type MessageOptions = { locale: Locale };

const RELATIVE_PERIOD_LABELS: Record<
  Exclude<Period, 'custom'>,
  (inputs: Record<string, never>, options: MessageOptions) => string
> = {
  '24h': m.period_24h,
  '7d': m.period_7d,
  '30d': m.period_30d,
  '1y': m.period_1y,
};

function getDateLabel(date: Date | null, locale: Locale): string {
  if (!date) return m.period_open_end({}, { locale });
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

export function getPeriodLabel(
  search: EarthquakeSearch,
  locale: Locale,
  now: Date = new Date(),
): string {
  if (search.period !== 'custom') return RELATIVE_PERIOD_LABELS[search.period]({}, { locale });
  const { start, end } = getTimeRange(search, now);
  return m.period_custom(
    { from: getDateLabel(start, locale), to: getDateLabel(end, locale) },
    { locale },
  );
}
