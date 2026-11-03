import { existsSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SERVER_ENTRY, type SmokeServer, startServer, stopProcess } from './server';
import { EMSC_ID, USGS_ID } from './upstream-double.mjs';

const PNG_SIGNATURE = '89504e470d0a1a0a';

let up: SmokeServer;
let down: SmokeServer;

async function getHtml(pathname: string): Promise<string> {
  const response = await fetch(`${up.origin}${pathname}`, { headers: { accept: 'text/html' } });
  return response.text();
}

function getProperty(html: string, property: string): string[] {
  const pattern = new RegExp(`<meta property="${property}" content="([^"]*)"`, 'g');
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

function getName(html: string, name: string): string[] {
  const pattern = new RegExp(`<meta name="${name}" content="([^"]*)"`, 'g');
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

async function getImage(server: SmokeServer, absoluteUrl: string) {
  const response = await fetch(`${server.origin}${new URL(absoluteUrl).pathname}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    cacheControl: response.headers.get('cache-control'),
    signature: bytes.subarray(0, 8).toString('hex'),
    width: bytes.length >= 24 ? bytes.readUInt32BE(16) : 0,
    height: bytes.length >= 24 ? bytes.readUInt32BE(20) : 0,
  };
}

beforeAll(async () => {
  if (!existsSync(SERVER_ENTRY)) throw new Error('Run `pnpm build` before `pnpm test:smoke`.');
  [up, down] = await Promise.all([startServer('up'), startServer('down')]);
});

afterAll(async () => {
  await Promise.all([up, down].map((server) => (server ? stopProcess(server.process) : undefined)));
});

describe.each([
  { catalogue: 'usgs', id: USGS_ID },
  { catalogue: 'emsc', id: EMSC_ID },
])('$catalogue detail page share card', ({ catalogue, id }) => {
  it('links one absolute, per-Earthquake image that renders as a 1200×630 PNG', async () => {
    const html = await getHtml(`/en/earthquakes/${catalogue}/${id}`);
    const images = getProperty(html, 'og:image');
    expect(images).toEqual([
      expect.stringMatching(
        new RegExp(`^https?://[^/]+/en/og/earthquakes/${catalogue}/${id}\\.png$`),
      ),
    ]);
    expect(getProperty(html, 'og:title')).toEqual([
      expect.stringMatching(/^M\d\.\d earthquake · /),
    ]);
    expect(getProperty(html, 'og:description')).toEqual([expect.stringMatching(/^Magnitude /)]);

    const image = await getImage(up, images[0]);
    expect(image).toMatchObject({
      status: 200,
      contentType: 'image/png',
      signature: PNG_SIGNATURE,
      width: 1200,
      height: 630,
    });
    expect(image.cacheControl).toContain('max-age=3600');
  });

  it('carries the Spanish locale, copy and image under /es', async () => {
    const html = await getHtml(`/es/earthquakes/${catalogue}/${id}`);
    expect(getProperty(html, 'og:locale')).toEqual(['es_ES']);
    expect(getProperty(html, 'og:locale:alternate')).toEqual(['en_US']);
    expect(getProperty(html, 'og:title')).toEqual([expect.stringMatching(/^Terremoto M/)]);
    expect(getProperty(html, 'og:image')).toEqual([
      expect.stringContaining(`/es/og/earthquakes/${catalogue}/${id}.png`),
    ]);
  });

  it('answers 404 for an unknown Earthquake image', async () => {
    const image = await getImage(up, `http://x/en/og/earthquakes/${catalogue}/doesnotexist123.png`);
    expect(image.status).toBe(404);
  });

  it('does not answer a cacheable image when the agency is down', async () => {
    const image = await getImage(down, `http://x/en/og/earthquakes/${catalogue}/${id}.png`);
    expect(image.status).toBeGreaterThanOrEqual(500);
    expect(image.cacheControl).toBe('no-store');
  });
});

describe('site share card', () => {
  it.each(['/en', '/en/map', '/es'])(
    '%s links the site image and a large card',
    async (pathname) => {
      const html = await getHtml(pathname);
      const locale = pathname.slice(1, 3);
      expect(getProperty(html, 'og:site_name')).toEqual(['Quake Watch']);
      expect(getProperty(html, 'og:image')).toEqual([
        expect.stringMatching(new RegExp(`^https?://[^/]+/${locale}/og/site\\.png$`)),
      ]);
      expect(getProperty(html, 'og:url')).toEqual([expect.stringContaining(pathname)]);
      expect(getName(html, 'twitter:card')).toEqual(['summary_large_image']);
    },
  );

  it('renders the site image as a 1200×630 PNG', async () => {
    const image = await getImage(up, 'http://x/es/og/site.png');
    expect(image).toMatchObject({
      status: 200,
      contentType: 'image/png',
      width: 1200,
      height: 630,
    });
  });

  it('answers 404 for an unknown catalogue', async () => {
    const image = await getImage(up, 'http://x/en/og/earthquakes/nope/abc.png');
    expect(image.status).toBe(404);
  });
});
