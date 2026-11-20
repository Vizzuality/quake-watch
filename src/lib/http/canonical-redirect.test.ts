import { describe, expect, it } from 'vitest';

import { getCanonicalRedirect } from './canonical-redirect';

const ORIGIN = 'https://quake.watch';

function getRequest(pathAndSearch: string, init: RequestInit = {}): Request {
  return new Request(new URL(pathAndSearch, ORIGIN), init);
}

async function getRedirectFor(pathAndSearch: string, init: RequestInit = {}) {
  const response = await getCanonicalRedirect(getRequest(pathAndSearch, init));
  return {
    status: response?.status,
    location: response?.headers.get('location'),
    vary: response?.headers.get('vary'),
  };
}

describe('getCanonicalRedirect', () => {
  it.each([
    ['/en/', '/en'],
    ['/es/', '/es'],
    ['/en//', '/en'],
    ['/en/?quake=usgs:us7000abcd', '/en?quake=usgs:us7000abcd'],
  ])('strips the trailing slash of %s with a 308 to %s', async (path, expected) => {
    expect(await getRedirectFor(path)).toEqual({ status: 308, location: expected, vary: null });
  });

  it.each([
    ['/', {}, '/en'],
    ['/', { 'accept-language': 'es-ES,es;q=0.9' }, '/es'],
    ['/', { 'accept-language': 'es', cookie: 'PARAGLIDE_LOCALE=pt' }, '/pt'],
    ['/?quake=emsc:1', { 'accept-language': 'pt-BR' }, '/pt?quake=emsc:1'],
    ['/about', { 'accept-language': 'fr' }, '/en/about'],
  ])('negotiates %s with %o into a 307 to %s', async (path, headers, expected) => {
    expect(await getRedirectFor(path, { headers })).toEqual({
      status: 307,
      location: expected,
      vary: 'Accept-Language, Cookie',
    });
  });

  it('answers the same with and without Sec-Fetch-Dest: document', async () => {
    const headers = { 'accept-language': 'es' };

    expect(await getRedirectFor('/', { headers })).toEqual(
      await getRedirectFor('/', { headers: { ...headers, 'sec-fetch-dest': 'document' } }),
    );
  });

  it.each([
    ['/en', {}],
    ['/es?quake=emsc:1', {}],
    ['/robots.txt', {}],
    ['/sitemap.xml', {}],
    ['/_serverFn/abc', {}],
    ['/', { method: 'POST' }],
  ])('leaves %s alone', async (path, init) => {
    expect(await getCanonicalRedirect(getRequest(path, init))).toBeNull();
  });
});
