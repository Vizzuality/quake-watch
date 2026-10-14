import { getDecimalLabel } from '@/lib/format';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

function getIsOne(count: number, locale: Locale): boolean {
  return new Intl.PluralRules(locale).select(count) === 'one';
}

export function getFeltReadoutText(intensity: string, count: number, locale: Locale): string {
  const formatted = getDecimalLabel(count, locale);
  return getIsOne(count, locale)
    ? m.detail_felt_readout_one({ intensity, count: formatted }, { locale })
    : m.detail_felt_readout_other({ intensity, count: formatted }, { locale });
}

export function getFeltStrongestText(intensity: string, count: number, locale: Locale): string {
  const formatted = getDecimalLabel(count, locale);
  return getIsOne(count, locale)
    ? m.detail_felt_strongest_one({ intensity, count: formatted }, { locale })
    : m.detail_felt_strongest_other({ intensity, count: formatted }, { locale });
}
