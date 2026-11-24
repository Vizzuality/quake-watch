import { describe, expect, it } from 'vitest';

import { getDetailTitle } from '@/lib/seo/detail-meta';

import { getCachedFormat, getIntlLocale } from './intl-locale';

describe('getCachedFormat', () => {
  it('creates a format once per key and reuses it', () => {
    const cache = new Map<string, Intl.NumberFormat>();
    let created = 0;
    function create() {
      created += 1;
      return new Intl.NumberFormat('en');
    }

    const first = getCachedFormat(cache, 'en', create);
    const second = getCachedFormat(cache, 'en', create);
    getCachedFormat(cache, 'es', create);

    expect(second).toBe(first);
    expect(created).toBe(2);
  });
});

describe('getIntlLocale', () => {
  it('formats Portuguese as European Portuguese and keeps the other locales', () => {
    expect(getIntlLocale('pt')).toBe('pt-PT');
    expect(getIntlLocale('en')).toBe('en');
    expect(getIntlLocale('es')).toBe('es');
  });

  it('writes pt dates and numbers the pt-PT way', () => {
    const earthquake = {
      id: 'us6000u18k',
      source: 'usgs' as const,
      magnitude: 7.7,
      magnitudeType: 'mww',
      place: 'Panamá',
      time: Date.parse('2026-10-09T17:56:06.036Z'),
      depthKm: 12.647,
      longitude: -80.769,
      latitude: 7.5868,
      url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us6000u18k',
    };
    expect(getDetailTitle(earthquake, 'pt')).toBe('Sismo M7.7 · Panamá · 09/10/2026 | Quake Watch');
    expect(new Intl.NumberFormat(getIntlLocale('pt')).format(12345.6)).toMatch(/^12\s345,6$/);
  });
});
