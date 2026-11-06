import { describe, expect, it } from 'vitest';

import { earthquakeSearchSchema } from '@/lib/earthquakes/search-schema';

import { getIntervalLabel, getPlaceLabel } from './labels';

describe('getIntervalLabel', () => {
  it.each([
    ['24h', 'en', 'last 24 hours'],
    ['3d', 'en', 'last 3 days'],
    ['7d', 'en', 'last 7 days'],
    ['24h', 'es', 'últimas 24 horas'],
    ['3d', 'es', 'últimos 3 días'],
    ['7d', 'es', 'últimos 7 días'],
  ] as const)('names %s in %s', (interval, locale, label) => {
    expect(getIntervalLabel(interval, locale)).toBe(label);
  });
});

describe('getPlaceLabel', () => {
  it('uses the place name or my location', () => {
    expect(
      getPlaceLabel(earthquakeSearchSchema.parse({ place: 'Granada', lat: 1, lon: 1 }), 'en'),
    ).toBe('Granada');
    expect(getPlaceLabel(earthquakeSearchSchema.parse({ lat: 1, lon: 1 }), 'es')).toBe(
      'Mi ubicación',
    );
  });
});
