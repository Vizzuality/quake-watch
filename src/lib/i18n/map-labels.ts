import type { StripTick } from '@/lib/earthquakes/area-strip';
import { getRoundedReachKm } from '@/lib/earthquakes/meaning';
import type { RelativeInterval, TimeFilters } from '@/lib/earthquakes/search-schema';
import { getKmLabel } from '@/lib/format';
import { getIntlLocale } from '@/lib/i18n/intl-locale';
import { getRangeInputs } from '@/lib/i18n/labels';
import { m } from '@/paraglide/messages';
import type { Locale } from '@/paraglide/runtime';

type MessageOptions = { locale: Locale };
type CaptionMessage = (inputs: { count: string }, options: MessageOptions) => string;

const AREA_CAPTIONS: Record<RelativeInterval, CaptionMessage> = {
  '24h': m.map_area_caption_24h,
  '3d': m.map_area_caption_3d,
  '7d': m.map_area_caption_7d,
  '1y': m.map_area_caption_1y,
};

const DAY_MONTH_OPTIONS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };

const CLOCK_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
};

function getDatePart(
  time: number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
  type: Intl.DateTimeFormatPartTypes,
): string {
  const parts = new Intl.DateTimeFormat(getIntlLocale(locale), {
    ...options,
    timeZone: 'UTC',
  }).formatToParts(time);
  return parts.find((part) => part.type === type)?.value ?? '';
}

function getWeekdayLabel(time: number, locale: Locale): string {
  return getDatePart(time, locale, { weekday: 'short' }, 'weekday');
}

function getClockLabel(time: number, locale: Locale): string {
  return new Intl.DateTimeFormat(getIntlLocale(locale), CLOCK_OPTIONS).format(time);
}

export function getFeltRingLabel(reachKm: number, locale: Locale): string {
  return m.map_likely_felt(
    { distance: getKmLabel(getRoundedReachKm(reachKm), locale) },
    { locale },
  );
}

export function getFeltRingShortLabel(reachKm: number, locale: Locale): string {
  return m.map_likely_felt_short(
    { distance: getKmLabel(getRoundedReachKm(reachKm), locale) },
    { locale },
  );
}

export function getStripTickLabel(
  { time, kind }: Pick<StripTick, 'time' | 'kind'>,
  locale: Locale,
): string {
  if (kind === 'hour') return getClockLabel(time, locale);
  const month = getDatePart(time, locale, DAY_MONTH_OPTIONS, 'month').replace('.', '');
  if (kind === 'month') return month;
  if (kind === 'date') return `${getDatePart(time, locale, DAY_MONTH_OPTIONS, 'day')} ${month}`;
  const day = getDatePart(time, locale, { day: '2-digit' }, 'day');
  return `${getWeekdayLabel(time, locale)} ${day}`;
}

export function getStripQuakeLabel(time: number, locale: Locale): string {
  return m.map_this_quake(
    { time: `${getWeekdayLabel(time, locale)} ${getClockLabel(time, locale)}` },
    { locale },
  );
}

function getAreaCountLabel(count: number, locale: Locale): string {
  const formatted = new Intl.NumberFormat(getIntlLocale(locale)).format(count);
  const isOne = new Intl.PluralRules(getIntlLocale(locale)).select(count) === 'one';
  return isOne
    ? m.map_area_count_one({ count: formatted }, { locale })
    : m.map_area_count_other({ count: formatted }, { locale });
}

export function getAreaCaption(filters: TimeFilters, count: number, locale: Locale): string {
  const countLabel = getAreaCountLabel(count, locale);
  if (filters.interval === 'custom') {
    return m.map_area_caption_custom(
      { ...getRangeInputs(filters, locale), count: countLabel },
      { locale },
    );
  }
  return AREA_CAPTIONS[filters.interval]({ count: countLabel }, { locale });
}
