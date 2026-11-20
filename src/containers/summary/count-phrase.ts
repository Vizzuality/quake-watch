import type { Interval } from '@/lib/earthquakes/search-schema';
import { getIntlLocale } from '@/lib/i18n/intl-locale';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

type CountPhrase = (inputs: Record<string, never>, options: { locale: Locale }) => string;

const COUNT_PHRASES: Record<Interval, { one: CountPhrase; other: CountPhrase }> = {
  '24h': { one: m.summary_earthquakes_24h_one, other: m.summary_earthquakes_24h_other },
  '3d': { one: m.summary_earthquakes_3d_one, other: m.summary_earthquakes_3d_other },
  '7d': { one: m.summary_earthquakes_7d_one, other: m.summary_earthquakes_7d_other },
};

export function getCountPhrase(interval: Interval, count: number, locale: Locale): string {
  const phrases = COUNT_PHRASES[interval];
  const phrase =
    new Intl.PluralRules(getIntlLocale(locale)).select(count) === 'one'
      ? phrases.one
      : phrases.other;
  return phrase({}, { locale });
}
