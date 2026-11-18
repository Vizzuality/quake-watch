import { getIntlLocale } from '@/lib/i18n/intl-locale';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

export function getEarthquakeCountLabel(count: number, locale: Locale): string {
  const formatted = new Intl.NumberFormat(getIntlLocale(locale)).format(count);
  const isOne = new Intl.PluralRules(getIntlLocale(locale)).select(count) === 'one';
  return isOne
    ? m.earthquake_count_one({ count: formatted }, { locale })
    : m.earthquake_count_other({ count: formatted }, { locale });
}
