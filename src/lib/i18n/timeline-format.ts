import type { HistogramUnit } from '@/lib/earthquakes/timeline';
import { getIntlLocale } from '@/lib/i18n/intl-locale';
import type { Locale } from '@/paraglide/runtime';

const BIN_FORMAT_OPTIONS: Record<HistogramUnit, Intl.DateTimeFormatOptions> = {
  hour: { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  day: { month: 'short', day: 'numeric' },
};

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export function getBinDateFormat(unit: HistogramUnit, locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getIntlLocale(locale), BIN_FORMAT_OPTIONS[unit]);
}

export function getDateTimeFormat(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getIntlLocale(locale), DATE_TIME_OPTIONS);
}
