import { describe, expect, it } from 'vitest';

import { earthquakeSearchSchema } from '@/lib/earthquakes/search-schema';

import { getPeriodLabel, getPeriodOptionLabel, getPlaceLabel } from './labels';

const NOW = new Date('2026-10-08T12:00:00.000Z');

function getCustomSearch(from: string | undefined, to: string | undefined) {
  return earthquakeSearchSchema.parse({ period: 'custom', from, to });
}

describe('getPeriodLabel', () => {
  it('names relative periods', () => {
    expect(getPeriodLabel(earthquakeSearchSchema.parse({ period: '7d' }), 'en')).toBe(
      'last 7 days',
    );
    expect(getPeriodLabel(earthquakeSearchSchema.parse({ period: '1y' }), 'es')).toBe('último año');
  });

  it('formats a closed custom range', () => {
    expect(getPeriodLabel(getCustomSearch('2026-08-01', '2026-08-14'), 'en', NOW)).toBe(
      'Aug 1, 2026 – Aug 14, 2026',
    );
  });

  it('labels a reversed custom range in fetch order', () => {
    expect(getPeriodLabel(getCustomSearch('2026-08-14', '2026-08-01'), 'en', NOW)).toBe(
      'Aug 1, 2026 – Aug 14, 2026',
    );
  });

  it('starts a range without a start date 24 hours before its end', () => {
    expect(getPeriodLabel(getCustomSearch(undefined, '2026-08-14'), 'en', NOW)).toBe(
      'Aug 13, 2026 – Aug 14, 2026',
    );
  });

  it('formats a custom range in spanish', () => {
    expect(getPeriodLabel(getCustomSearch('2026-08-01', '2026-08-14'), 'es', NOW)).toBe(
      '1 ago 2026 – 14 ago 2026',
    );
  });

  it('formats a custom range with an open end', () => {
    expect(
      getPeriodLabel(earthquakeSearchSchema.parse({ period: 'custom', from: '2026-08-14' }), 'en'),
    ).toBe('Aug 14, 2026 – today');
  });
});

describe('getPeriodOptionLabel', () => {
  it('names the custom option', () => {
    expect(getPeriodOptionLabel('custom', 'en')).toBe('Custom dates');
    expect(getPeriodOptionLabel('7d', 'es')).toBe('últimos 7 días');
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
