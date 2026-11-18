import { describe, expect, it } from 'vitest';

import type { Earthquake } from '@/lib/earthquakes/types';

import {
  getAlternateOgLocales,
  getEarthquakeOpenGraphMeta,
  getEarthquakeShareImageUrl,
  getSiteOpenGraphMeta,
  getSiteShareImageUrl,
} from './open-graph';
import type { OpenGraphTag } from './open-graph';

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

function getContents(tags: OpenGraphTag[], key: string): string[] {
  return tags
    .filter((tag) => ('property' in tag ? tag.property : tag.name) === key)
    .map((tag) => tag.content);
}

function getContent(tags: OpenGraphTag[], key: string): string | undefined {
  return getContents(tags, key)[0];
}

describe('share image URLs', () => {
  it('serves the site image under the locale prefix as an absolute URL', () => {
    expect(getSiteShareImageUrl('en')).toBe('https://quake-watch.up.railway.app/en/og/site.png');
    expect(getSiteShareImageUrl('es')).toBe('https://quake-watch.up.railway.app/es/og/site.png');
    expect(getSiteShareImageUrl('pt')).toBe('https://quake-watch.up.railway.app/pt/og/site.png');
  });

  it('serves one image per Earthquake, catalogue and locale', () => {
    expect(getEarthquakeShareImageUrl(PANAMA, 'es')).toBe(
      'https://quake-watch.up.railway.app/es/og/earthquakes/usgs/us6000u18k.png',
    );
  });

  it('encodes an id that is not URL-safe', () => {
    expect(getEarthquakeShareImageUrl({ source: 'emsc', id: 'a/b c' }, 'en')).toBe(
      'https://quake-watch.up.railway.app/en/og/earthquakes/emsc/a%2Fb%20c.png',
    );
  });
});

describe('getSiteOpenGraphMeta', () => {
  const url = 'https://quake-watch.up.railway.app/es/map';
  const tags = getSiteOpenGraphMeta({ title: 'Mapa | Quake Watch', url, locale: 'es' });

  it('names the site, the page and its canonical URL', () => {
    expect(getContent(tags, 'og:site_name')).toBe('Quake Watch');
    expect(getContent(tags, 'og:type')).toBe('website');
    expect(getContent(tags, 'og:title')).toBe('Mapa | Quake Watch');
    expect(getContent(tags, 'og:url')).toBe(url);
  });

  it('declares the page locale and leaves the alternates to the document head', () => {
    expect(getContent(tags, 'og:locale')).toBe('es_ES');
    expect(getContents(tags, 'og:locale:alternate')).toEqual([]);
    const portuguese = getSiteOpenGraphMeta({ title: 'Mapa', url, locale: 'pt' });
    expect(getContent(portuguese, 'og:locale')).toBe('pt_PT');
    expect(getContent(portuguese, 'og:description')).toBe(
      'Sismos em todo o mundo, à medida que acontecem.',
    );
  });

  it('lists every other locale as an og:locale alternate', () => {
    expect(getAlternateOgLocales('en')).toEqual(['es_ES', 'pt_PT']);
    expect(getAlternateOgLocales('es')).toEqual(['en_US', 'pt_PT']);
    expect(getAlternateOgLocales('pt')).toEqual(['en_US', 'es_ES']);
  });

  it('describes the site and asks for a large image card', () => {
    expect(getContent(tags, 'og:description')).toBe(
      'Terremotos de todo el mundo, en cuanto ocurren.',
    );
    expect(getContent(tags, 'twitter:card')).toBe('summary_large_image');
  });

  it('points to the 1200×630 site image with alt text', () => {
    expect(getContent(tags, 'og:image')).toBe(getSiteShareImageUrl('es'));
    expect(getContent(tags, 'og:image:type')).toBe('image/png');
    expect(getContent(tags, 'og:image:width')).toBe('1200');
    expect(getContent(tags, 'og:image:height')).toBe('630');
    expect(getContent(tags, 'og:image:alt')).toBe(
      'Quake Watch: Terremotos, explicados para todos. Terremotos M6+, 2000–2025',
    );
    expect(getContent(tags, 'twitter:image:alt')).toBe(getContent(tags, 'og:image:alt'));
  });
});

describe('getEarthquakeOpenGraphMeta', () => {
  const tags = getEarthquakeOpenGraphMeta({
    earthquake: PANAMA,
    title: 'Title',
    description: 'Description',
    dateLabel: 'Oct 9, 2026',
    locale: 'en',
  });

  it('repeats the page title and description', () => {
    expect(getContent(tags, 'og:title')).toBe('Title');
    expect(getContent(tags, 'og:description')).toBe('Description');
  });

  it("points to the Earthquake's own image and describes it", () => {
    expect(getContent(tags, 'og:image')).toBe(getEarthquakeShareImageUrl(PANAMA, 'en'));
    expect(getContent(tags, 'og:image:alt')).toBe(
      'Magnitude 7.7 earthquake, 12 km WSW of Pitaloza Arriba, Panama, Oct 9, 2026',
    );
  });

  it('names an unknown place in the alt text', () => {
    const unknown = getEarthquakeOpenGraphMeta({
      earthquake: { ...PANAMA, place: null },
      title: 'Title',
      description: 'Description',
      dateLabel: '9 oct 2026',
      locale: 'es',
    });
    expect(getContent(unknown, 'og:image:alt')).toMatch(
      /^Terremoto de magnitud 7\.7, .+, 9 oct 2026$/,
    );
    expect(getContent(unknown, 'og:image:alt')).not.toContain('null');
  });
});
