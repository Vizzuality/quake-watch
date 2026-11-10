import { describe, expect, it } from 'vitest';

import { getKmLabel } from '@/lib/format';

import { getEarthquakeMeaning } from './meaning';
import {
  getTooltipAge,
  getTooltipCompactMeta,
  getTooltipDate,
  getTooltipFelt,
  getTooltipMagnitude,
} from './tooltip';

const NOW = Date.UTC(2026, 10, 10, 12, 0);
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

describe('getTooltipAge', () => {
  it.each([
    [0, 'en', '0 min ago'],
    [59 * MINUTE_MS + 59_000, 'en', '59 min ago'],
    [HOUR_MS, 'en', '1 h ago'],
    [47 * HOUR_MS + 59 * MINUTE_MS, 'en', '47 h ago'],
    [48 * HOUR_MS, 'en', '2 d ago'],
    [6 * 24 * HOUR_MS + 23 * HOUR_MS, 'en', '6 d ago'],
    [12 * MINUTE_MS, 'es', 'hace 12 min'],
    [5 * HOUR_MS, 'es', 'hace 5 h'],
    [3 * 24 * HOUR_MS, 'es', 'hace 3 d'],
  ] as const)('labels %i ms in %s as %s', (elapsedMs, locale, label) => {
    expect(getTooltipAge(NOW - elapsedMs, NOW, locale)).toBe(label);
  });

  it('treats a quake slightly in the future as 0 min ago', () => {
    expect(getTooltipAge(NOW + 5000, NOW, 'en')).toBe('0 min ago');
  });
});

describe('getTooltipDate', () => {
  const time = Date.UTC(2026, 9, 31, 4, 12);

  it('formats the UTC weekday, day.month and 24 h time', () => {
    expect(getTooltipDate(time, 'en')).toBe('Sat 31.10 · 04:12 UTC');
    expect(getTooltipDate(Date.UTC(2026, 0, 5, 23, 7), 'en')).toBe('Mon 05.01 · 23:07 UTC');
  });

  it('names the weekday in Spanish', () => {
    expect(getTooltipDate(time, 'es')).toBe('sáb 31.10 · 04:12 UTC');
  });
});

describe('getTooltipCompactMeta', () => {
  const time = Date.UTC(2026, 9, 28, 14, 5);

  it('joins weekday, day, time and depth', () => {
    expect(getTooltipCompactMeta(time, 22.4, 'en')).toBe('Wed 28 · 14:05 · 22 km deep');
    expect(getTooltipCompactMeta(time, 22.4, 'es')).toBe('mié 28 · 14:05 · 22 km de profundidad');
  });
});

describe('getTooltipFelt', () => {
  it('gives the rounded Felt reach', () => {
    const meaning = getEarthquakeMeaning({ magnitude: 5.1, depthKm: 10, distanceKm: null });
    if (meaning.kind !== 'felt-reach') throw new Error('expected a Felt reach');
    expect(getTooltipFelt(5.1, 10, 'en')).toBe(`~${getKmLabel(meaning.reachKm, 'en')}`);
    expect(getTooltipFelt(5.1, 10, 'en')).toMatch(/^~\d[\d,]* km$/);
  });

  it('says Not felt when the quake is too small', () => {
    expect(getTooltipFelt(0.5, 30, 'en')).toBe('Not felt');
    expect(getTooltipFelt(0.5, 30, 'es')).toBe('No sentido');
  });
});

describe('getTooltipMagnitude', () => {
  it.each([
    [5.1, 'en', 'M5.1'],
    [5.14, 'en', 'M5.1'],
    [6, 'en', 'M6.0'],
    [4.3, 'es', 'M4,3'],
  ] as const)('labels %f in %s as %s', (magnitude, locale, label) => {
    expect(getTooltipMagnitude(magnitude, locale)).toBe(label);
  });
});
