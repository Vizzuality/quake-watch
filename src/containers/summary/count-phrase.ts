import type { RelativeInterval, TimeFilters } from '@/lib/earthquakes/search-schema';
import { getCachedFormat, getIntlLocale } from '@/lib/i18n/intl-locale';
import { getRangeInputs } from '@/lib/i18n/labels';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

type CountPhrase = (inputs: Record<string, never>, options: { locale: Locale }) => string;

const COUNT_PHRASES: Record<RelativeInterval, { one: CountPhrase; other: CountPhrase }> = {
  '24h': { one: m.summary_earthquakes_24h_one, other: m.summary_earthquakes_24h_other },
  '3d': { one: m.summary_earthquakes_3d_one, other: m.summary_earthquakes_3d_other },
  '7d': { one: m.summary_earthquakes_7d_one, other: m.summary_earthquakes_7d_other },
  '1y': { one: m.summary_earthquakes_1y_one, other: m.summary_earthquakes_1y_other },
};

const pluralRules = new Map<string, Intl.PluralRules>();

export function getCountPhrase(filters: TimeFilters, count: number, locale: Locale): string {
  const rules = getCachedFormat(
    pluralRules,
    locale,
    () => new Intl.PluralRules(getIntlLocale(locale)),
  );
  const isOne = rules.select(count) === 'one';
  if (filters.interval === 'custom') {
    const inputs = getRangeInputs(filters, locale);
    if (isOne) return m.summary_earthquakes_custom_one(inputs, { locale });
    return m.summary_earthquakes_custom_other(inputs, { locale });
  }
  const phrases = COUNT_PHRASES[filters.interval];
  const phrase = isOne ? phrases.one : phrases.other;
  return phrase({}, { locale });
}
