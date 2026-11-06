import { describe, expect, it } from 'vitest';

import { earthquakeSearchSchema } from '@/lib/earthquakes/search-schema';

import { getLegacyRedirect } from './legacy-redirect';

function getRedirectFor(pathAndSearch: string): string | null {
  return getLegacyRedirect(new URL(pathAndSearch, 'https://quake.watch'));
}

describe('getLegacyRedirect', () => {
  it.each([
    ['/en/map', '/en'],
    ['/es/map', '/es'],
    ['/en/map/', '/en'],
    ['/en/map?minmag=4', '/en?minmag=4'],
    ['/es/map?minmag=4&days=7', '/es?minmag=4'],
    ['/en/map?minmag=2.5&period=7d', '/en'],
    ['/en/map?period=30d&minmag=2.5&radius=250&sort=time.desc', '/en'],
    ['/en/map?minmag=4.5&period=24h&source=usgs', '/en?source=usgs&interval=24h&minmag=4'],
    ['/en/map?period=1y', '/en'],
    ['/en/map?period=custom', '/en'],
    ['/en/map?minmag=7.2', '/en?minmag=6'],
    ['/en/map?minmag=-1', '/en'],
    ['/en/map?minmag=abc', '/en'],
    ['/en/map?source=emsc', '/en'],
    ['/en/map?source=foo', '/en'],
    ['/en/map?place=Tokyo', '/en?place=Tokyo'],
    ['/en/map?place=%20Lima%20', '/en?place=Lima'],
    ['/en/map?place=12345', '/en'],
    ['/en/map?place=%2212345%22', '/en?place=%2212345%22'],
    ['/en/map?lat=37.1789&lon=-122.4567', '/en?lat=37.18&lon=-122.46'],
    ['/en/map?lat=91&lon=abc', '/en'],
    [
      '/en/map?lon=10&lat=20&minmag=3&place=Rome&period=24h&source=usgs',
      '/en?source=usgs&place=Rome&interval=24h&minmag=3&lat=20&lon=10',
    ],
  ])('redirects %s to %s', (input, expected) => {
    expect(getRedirectFor(input)).toBe(expected);
  });

  it.each([
    ['/en/earthquakes/usgs/us7000abcd', '/en?quake=usgs:us7000abcd'],
    ['/es/earthquakes/usgs/us7000abcd', '/es?quake=usgs:us7000abcd'],
    ['/es/earthquakes/emsc/20261105_0000104', '/es?quake=emsc:20261105_0000104'],
    ['/en/earthquakes/emsc/20261105_0000104/', '/en?quake=emsc:20261105_0000104'],
    ['/en/earthquakes/usgs/us7000abcd?tab=map', '/en?quake=usgs:us7000abcd'],
  ])('redirects %s to %s', (input, expected) => {
    expect(getRedirectFor(input)).toBe(expected);
  });

  it('does not throw on a malformed percent-encoded id', () => {
    expect(getRedirectFor('/en/earthquakes/usgs/%E0%A4%A')).toEqual(expect.any(String));
  });

  it.each(['/en/earthquakes/usgs/a&quake=emsc:x', '/en/earthquakes/usgs/a%26quake%3Demsc%3Ax'])(
    'keeps a single quake param for %s',
    (input) => {
      const target = getRedirectFor(input) ?? '';
      const params = new URLSearchParams(target.slice(target.indexOf('?')));
      expect([...params.keys()]).toEqual(['quake']);
    },
  );

  it('produces a quake value the search schema accepts', () => {
    const target = getRedirectFor('/en/earthquakes/usgs/us7000abcd') ?? '';
    const quake = new URLSearchParams(target.slice(target.indexOf('?'))).get('quake');
    expect(earthquakeSearchSchema.shape.quake.parse(quake)).toBe('usgs:us7000abcd');
  });

  it.each([
    '/en',
    '/es',
    '/en/mapx',
    '/map',
    '/fr/map',
    '/en/earthquakes/foo/1',
    '/en/earthquakes/usgs',
    '/en/earthquakes/usgs/a/b',
    '/earthquakes/usgs/us7000abcd',
  ])('returns null for %s', (input) => {
    expect(getRedirectFor(input)).toBeNull();
  });
});
