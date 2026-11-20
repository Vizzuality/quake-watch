import { existsSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SERVER_ENTRY, type SmokeServer, startServer, stopProcess } from './server';

let server: SmokeServer | undefined;

beforeAll(async () => {
  if (!existsSync(SERVER_ENTRY)) throw new Error('Run `pnpm build` before `pnpm test:smoke`.');
  server = await startServer('up');
});

afterAll(async () => {
  if (server) await stopProcess(server.process);
});

describe('legacy redirects', () => {
  it.each([
    ['/en/earthquakes/usgs/us7000abcd', '/en?quake=usgs:us7000abcd'],
    ['/es/earthquakes/emsc/20261105_0000104', '/es?quake=emsc:20261105_0000104'],
    ['/en/map?minmag=4', '/en?minmag=4'],
    ['/en/map', '/en'],
    ['/en/map?period=30d&minmag=2.5&radius=250&sort=time.desc', '/en'],
    ['/en/map?minmag=4.5&period=24h&source=usgs', '/en?source=usgs&interval=24h&minmag=4'],
  ])('%s → 308 %s', async (pathname, expected) => {
    if (!server) throw new Error('Smoke server did not start');
    const response = await fetch(`${server.origin}${pathname}`, { redirect: 'manual' });
    const location = response.headers.get('location');
    expect(response.status).toBe(308);
    expect(location).toBe(expected);
  });
});

describe('canonical redirects', () => {
  it.each([
    ['/en/', '/en'],
    ['/es/?quake=emsc:1', '/es?quake=emsc:1'],
  ])('%s → 308 %s', async (pathname, expected) => {
    if (!server) throw new Error('Smoke server did not start');
    const response = await fetch(`${server.origin}${pathname}`, { redirect: 'manual' });
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(expected);
  });

  it.each<Record<string, string>>([{}, { 'sec-fetch-dest': 'document' }])(
    'negotiates / into a 307 that varies on language and cookie with %o',
    async (headers) => {
      if (!server) throw new Error('Smoke server did not start');
      const response = await fetch(`${server.origin}/`, {
        redirect: 'manual',
        headers: { 'accept-language': 'es', ...headers },
      });
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('/es');
      expect(response.headers.get('vary')).toBe('Accept-Language, Cookie');
    },
  );
});

describe('icons and manifest', () => {
  it.each([
    ['/favicon.ico', 'image/vnd.microsoft.icon'],
    ['/icon.svg', 'image/svg+xml'],
    ['/apple-touch-icon.png', 'image/png'],
    ['/icon-192.png', 'image/png'],
    ['/icon-512.png', 'image/png'],
    ['/site.webmanifest', 'application/manifest+json'],
  ])('serves %s as %s without a redirect', async (pathname, contentType) => {
    if (!server) throw new Error('Smoke server did not start');
    const response = await fetch(`${server.origin}${pathname}`, { redirect: 'manual' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(contentType);
  });
});
