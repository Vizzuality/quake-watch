import { CLOCK_TIME_FORMAT, LOCAL_DATE_TIME_FORMAT, getTimeLabel } from './format';

const EXTREME_TIME_ZONES = ['Etc/GMT+12', 'UTC', 'Pacific/Kiritimati'];

const WIDEST_TWO_DIGITS = '22';
const TWO_DIGIT_PARTS = new Set<Intl.DateTimeFormatPartTypes>(['day', 'hour']);
const LONGEST_MINUTES_ELAPSED_MS = 59 * 60_000;
const LONGEST_HOURS_ELAPSED_MS = 23 * 3_600_000;

function getLongestLabel(labels: string[]): string {
  return labels.reduce((longest, label) => (label.length > longest.length ? label : longest), '');
}

function getPartValue(partLists: Intl.DateTimeFormatPart[][], index: number): string {
  const values = partLists.map((parts) => parts[index]?.value ?? '');
  return getLongestLabel(values);
}

function getWidestDateTimeLabel(
  time: number,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const partLists = EXTREME_TIME_ZONES.map((timeZone) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone }).formatToParts(time),
  );
  return (partLists[0] ?? [])
    .map(({ type }, index) => {
      if (TWO_DIGIT_PARTS.has(type)) return WIDEST_TWO_DIGITS;
      return getPartValue(partLists, index);
    })
    .join('');
}

export function getLocalDateTimePlaceholder(time: number, locale: string): string {
  return getWidestDateTimeLabel(time, locale, LOCAL_DATE_TIME_FORMAT);
}

export function getClockTimePlaceholder(time: number, locale: string): string {
  return getWidestDateTimeLabel(time, locale, CLOCK_TIME_FORMAT);
}

export function getTimeLabelPlaceholder(time: number, locale: string): string {
  return getLongestLabel([
    getTimeLabel(time, time + LONGEST_MINUTES_ELAPSED_MS, locale),
    getTimeLabel(time, time + LONGEST_HOURS_ELAPSED_MS, locale),
    getWidestDateTimeLabel(time, locale, { dateStyle: 'medium', timeStyle: 'short' }),
  ]);
}
