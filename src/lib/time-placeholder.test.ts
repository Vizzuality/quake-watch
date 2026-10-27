import { describe, expect, it } from 'vitest';

import { getLocalDateTimeLabel, getTimeLabel } from './format';
import { getLocalDateTimePlaceholder, getTimeLabelPlaceholder } from './time-placeholder';

const READER_TIME_ZONES = [
  'UTC',
  'Europe/Madrid',
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'America/Sao_Paulo',
  'America/Los_Angeles',
  'America/St_Johns',
  'Pacific/Chatham',
  'Pacific/Marquesas',
  'Australia/Lord_Howe',
];

const TIMES = [
  Date.parse('2026-10-09T17:56:06.036Z'),
  Date.parse('2026-10-31T23:30:00.000Z'),
  Date.parse('2026-09-30T11:05:00.000Z'),
  Date.parse('2026-05-01T00:10:00.000Z'),
];

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

describe.each(['en', 'es'] as const)('placeholders in %s', (locale) => {
  it.each(TIMES)('reserve at least the longest local date and time for %i', (time) => {
    const placeholder = getLocalDateTimePlaceholder(time, locale);
    for (const timeZone of READER_TIME_ZONES) {
      expect(placeholder.length).toBeGreaterThanOrEqual(
        getLocalDateTimeLabel(time, locale, timeZone).length,
      );
    }
  });

  it.each(TIMES)('reserve at least the longest relative or absolute label for %i', (time) => {
    const placeholder = getTimeLabelPlaceholder(time, locale);
    const elapsedCases = [0, 59 * 60_000, HOUR_MS, 23 * HOUR_MS, DAY_MS, 30 * DAY_MS];
    for (const timeZone of READER_TIME_ZONES) {
      for (const elapsed of elapsedCases) {
        expect(placeholder.length).toBeGreaterThanOrEqual(
          getTimeLabel(time, time + elapsed, locale, timeZone).length,
        );
      }
    }
  });

  it('is the same on every call so server and client agree', () => {
    expect(getLocalDateTimePlaceholder(TIMES[0]!, locale)).toBe(
      getLocalDateTimePlaceholder(TIMES[0]!, locale),
    );
    expect(getTimeLabelPlaceholder(TIMES[0]!, locale)).toBe(
      getTimeLabelPlaceholder(TIMES[0]!, locale),
    );
  });
});
