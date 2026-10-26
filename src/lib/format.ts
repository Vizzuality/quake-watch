const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function getRelativeTimeLabel(elapsedMs: number, locale: string): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (elapsedMs < HOUR_MS) return format.format(-Math.round(elapsedMs / MINUTE_MS), 'minute');
  return format.format(-Math.round(elapsedMs / HOUR_MS), 'hour');
}

export function getTimeLabel(time: number, now: number, locale: string, timeZone?: string): string {
  const elapsedMs = now - time;
  if (elapsedMs >= 0 && elapsedMs < DAY_MS) return getRelativeTimeLabel(elapsedMs, locale);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(time);
}

export function getKmLabel(km: number, locale: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilometer',
    maximumFractionDigits: fractionDigits,
  }).format(km);
}

export function getDecimalLabel(value: number, locale: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: fractionDigits }).format(value);
}

export function getDegreesLabel(degrees: number, locale: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'degree',
    unitDisplay: 'narrow',
    maximumFractionDigits: fractionDigits,
  }).format(degrees);
}

export function getSecondsLabel(seconds: number, locale: string, fractionDigits = 2): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'second',
    unitDisplay: 'narrow',
    maximumFractionDigits: fractionDigits,
  }).format(seconds);
}

export function getPercentLabel(fraction: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    fraction,
  );
}

const COORDINATE_DIGITS = 3;

function getCoordinateLabel(value: number, hemispheres: readonly [string, string], locale: string) {
  const hemisphere = value < 0 ? hemispheres[1] : hemispheres[0];
  return `${getDecimalLabel(Math.abs(value), locale, COORDINATE_DIGITS)}° ${hemisphere}`;
}

export function getCoordinatesLabel(
  { latitude, longitude }: { latitude: number; longitude: number },
  locale: string,
): string {
  const latitudeLabel = getCoordinateLabel(latitude, ['N', 'S'], locale);
  const longitudeLabel = getCoordinateLabel(longitude, ['E', locale === 'es' ? 'O' : 'W'], locale);
  return `${latitudeLabel}, ${longitudeLabel}`;
}

export function getScientificLabel(value: number, locale: string): string {
  const [mantissa = '0', exponent = '0'] = value.toExponential(2).split('e');
  const power = String(Number(exponent))
    .split('')
    .map((char) => (char === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'.charAt(Number(char))))
    .join('');
  return `${getDecimalLabel(Number(mantissa), locale, 2)} × 10${power}`;
}

export function getFullDateTimeLabel(time: number, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'long',
    timeZone,
  }).format(time);
}

export const LOCAL_DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: 'long',
  timeStyle: 'medium',
};

export function getLocalDateTimeLabel(time: number, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, { ...LOCAL_DATE_TIME_FORMAT, timeZone }).format(time);
}
