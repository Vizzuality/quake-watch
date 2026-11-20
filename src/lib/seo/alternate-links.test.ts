import { afterEach, describe, expect, it } from 'vitest';

import { EARTHQUAKE_SEARCH_DEFAULTS } from '@/lib/earthquakes/search-schema';
import { overwriteGetLocale } from '@/paraglide/runtime';

import { getAlternateLinks } from './alternate-links';

const ORIGIN = 'https://quake-watch.up.railway.app';

afterEach(() => {
  overwriteGetLocale(() => 'en');
});

describe('getAlternateLinks', () => {
  it('links the localized home pages', () => {
    expect(getAlternateLinks({ pathname: '/', search: EARTHQUAKE_SEARCH_DEFAULTS })).toEqual({
      canonical: `${ORIGIN}/en`,
      alternates: [
        { hreflang: 'en', href: `${ORIGIN}/en` },
        { hreflang: 'es', href: `${ORIGIN}/es` },
        { hreflang: 'pt', href: `${ORIGIN}/pt` },
        { hreflang: 'x-default', href: `${ORIGIN}/` },
      ],
      isNoindex: false,
    });
  });

  it('canonicalises to the current locale with reciprocal alternates', () => {
    overwriteGetLocale(() => 'es');

    expect(getAlternateLinks({ pathname: '/', search: EARTHQUAKE_SEARCH_DEFAULTS })).toEqual({
      canonical: `${ORIGIN}/es`,
      alternates: [
        { hreflang: 'en', href: `${ORIGIN}/en` },
        { hreflang: 'es', href: `${ORIGIN}/es` },
        { hreflang: 'pt', href: `${ORIGIN}/pt` },
        { hreflang: 'x-default', href: `${ORIGIN}/` },
      ],
      isNoindex: false,
    });
  });

  it('canonicalises a Portuguese page to /pt', () => {
    overwriteGetLocale(() => 'pt');

    expect(getAlternateLinks({ pathname: '/', search: {} }).canonical).toBe(`${ORIGIN}/pt`);
  });

  it('drops search params from the canonical', () => {
    const links = getAlternateLinks({ pathname: '/', search: { quake: 'usgs:us6000u4j2' } });

    expect(links.canonical).toBe(`${ORIGIN}/en`);
    expect(links.isNoindex).toBe(true);
  });

  it('keeps only the shared quake in the canonical and alternates', () => {
    overwriteGetLocale(() => 'es');

    const links = getAlternateLinks({
      pathname: '/',
      search: { quake: 'usgs:us6000u4j2', lat: 10, lon: 20, zoom: 2 },
      quake: 'usgs:us6000u4j2',
    });

    expect(links.canonical).toBe(`${ORIGIN}/es?quake=usgs:us6000u4j2`);
    expect(links.alternates).toEqual([
      { hreflang: 'en', href: `${ORIGIN}/en?quake=usgs:us6000u4j2` },
      { hreflang: 'es', href: `${ORIGIN}/es?quake=usgs:us6000u4j2` },
      { hreflang: 'pt', href: `${ORIGIN}/pt?quake=usgs:us6000u4j2` },
      { hreflang: 'x-default', href: `${ORIGIN}/?quake=usgs:us6000u4j2` },
    ]);
  });

  it('indexes the home page without search params', () => {
    expect(getAlternateLinks({ pathname: '/', search: {} }).isNoindex).toBe(false);
  });

  it('noindexes a camera URL', () => {
    expect(
      getAlternateLinks({
        pathname: '/',
        search: { ...EARTHQUAKE_SEARCH_DEFAULTS, lat: 10, lon: 20, zoom: 2 },
      }).isNoindex,
    ).toBe(true);
  });

  it('noindexes a filter that differs from the defaults', () => {
    expect(
      getAlternateLinks({ pathname: '/', search: { ...EARTHQUAKE_SEARCH_DEFAULTS, minmag: 4 } })
        .isNoindex,
    ).toBe(true);
  });

  it('ignores keys whose value is undefined', () => {
    expect(getAlternateLinks({ pathname: '/', search: { place: undefined } }).isNoindex).toBe(
      false,
    );
  });
});
