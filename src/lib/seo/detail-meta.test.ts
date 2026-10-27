import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Earthquake } from '@/lib/earthquakes/types';

import { getDetailDescription, getDetailMeta, getDetailTitle } from './detail-meta';

const PANAMA: Earthquake = {
  id: 'us6000u18k',
  source: 'usgs',
  magnitude: 7.7,
  magnitudeType: 'mww',
  place: '12 km WSW of Pitaloza Arriba, Panama',
  time: Date.parse('2026-10-09T17:56:06.036Z'),
  depthKm: 12.647,
  longitude: -80.769,
  latitude: 7.5868,
  url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us6000u18k',
};

const NBSP = ' ';
const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'Asia/Tokyo';
});

afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe('getDetailTitle', () => {
  it('leads with the Magnitude, then the place and the UTC date', () => {
    expect(getDetailTitle(PANAMA, 'en')).toBe(
      'M7.7 earthquake · 12 km WSW of Pitaloza Arriba, Panama · Oct 9, 2026 | Quake Watch',
    );
  });

  it('localizes the wording and the date', () => {
    expect(getDetailTitle(PANAMA, 'es')).toBe(
      'Terremoto M7.7 · 12 km WSW of Pitaloza Arriba, Panama · 9 oct 2026 | Quake Watch',
    );
  });

  it('dates the Earthquake in UTC, not in the server time zone', () => {
    const lateEvening = { ...PANAMA, time: Date.parse('2026-10-26T23:30:00.000Z') };
    expect(getDetailTitle(lateEvening, 'en')).toContain('Oct 26, 2026');
  });

  it('names an unknown place instead of leaving a gap', () => {
    expect(getDetailTitle({ ...PANAMA, place: null }, 'en')).toBe(
      'M7.7 earthquake · Unknown location · Oct 9, 2026 | Quake Watch',
    );
  });

  it('keeps & and < verbatim so the renderer escapes them once', () => {
    expect(getDetailTitle({ ...PANAMA, place: 'Tom & Jerry <Bay>' }, 'en')).toContain(
      '· Tom & Jerry <Bay> ·',
    );
  });
});

describe('getDetailDescription', () => {
  it('states Magnitude, Depth, UTC time and the estimated Felt reach', () => {
    expect(getDetailDescription(PANAMA, 'en')).toBe(
      `Magnitude 7.7 Earthquake, 12 km WSW of Pitaloza Arriba, Panama. Depth: 12.6 km. Time: October 9, 2026 at 5:56:06 PM UTC. Likely felt up to ~3,400${NBSP}km away.`,
    );
  });

  it('uses the Spanish vocabulary in Spanish', () => {
    expect(getDetailDescription(PANAMA, 'es')).toBe(
      `Terremoto de magnitud 7.7, 12 km WSW of Pitaloza Arriba, Panama. Profundidad: 12,6 km. Hora: 9 de octubre de 2026 a las 17:56:06 UTC. Probablemente se sintió hasta a ~3400${NBSP}km.`,
    );
  });

  it('says a small Earthquake was likely not felt', () => {
    expect(getDetailDescription({ ...PANAMA, magnitude: 1.2, depthKm: 10 }, 'en')).toMatch(
      /Likely not felt\.$/,
    );
  });

  it('names an unknown place', () => {
    expect(getDetailDescription({ ...PANAMA, place: null }, 'en')).toContain(
      'Earthquake, Unknown location.',
    );
  });

  it('ends the sentence once when the place already ends with a period', () => {
    const description = getDetailDescription(
      { ...PANAMA, place: 'New Britain Region, P.n.g.' },
      'en',
    );
    expect(description).toContain('Earthquake, New Britain Region, P.n.g. Depth:');
    expect(description).not.toContain('..');
  });
});

describe('getDetailMeta', () => {
  it('gives a found Earthquake its own title and description', () => {
    expect(getDetailMeta({ status: 'success', earthquake: PANAMA, locale: 'en' })).toEqual([
      { title: getDetailTitle(PANAMA, 'en') },
      { name: 'description', content: getDetailDescription(PANAMA, 'en') },
    ]);
  });

  it('keeps the site defaults while the Earthquake is not loaded yet', () => {
    expect(getDetailMeta({ status: 'success', earthquake: undefined, locale: 'en' })).toEqual([]);
  });

  it.each(['notFound', 'error'] as const)('asks crawlers not to index a %s page', (status) => {
    expect(getDetailMeta({ status, earthquake: undefined, locale: 'en' })).toEqual([
      { name: 'robots', content: 'noindex' },
    ]);
  });
});
