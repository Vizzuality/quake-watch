import { describe, expect, it } from 'vitest';

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
    ['/es/map?minmag=4&days=7', '/es?minmag=4&days=7'],
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
