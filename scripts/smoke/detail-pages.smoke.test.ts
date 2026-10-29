import { existsSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isSiteIndexableFromEnv } from '../../src/lib/seo/indexing';
import { SERVER_ENTRY, type SmokeServer, startServer, stopProcess } from './server';
import {
  EMSC_ID,
  ESCAPE_PLACE,
  SCRIPT_PLACE,
  USGS_ESCAPE_ID,
  USGS_ID,
  USGS_SCRIPT_ID,
} from './upstream-double.mjs';

const USGS_PLACE = '12 km WSW of Pitaloza Arriba, Panama';
const EMSC_PLACE = 'New Britain Region, P.n.g.';
const NOINDEX = '<meta name="robots" content="noindex"/>';
const SITE_ROBOTS = isSiteIndexableFromEnv(process.env.VITE_SITE_INDEXABLE)
  ? []
  : ['noindex,follow'];

async function stopServers(servers: (SmokeServer | undefined)[]): Promise<void> {
  await Promise.all(servers.map((server) => (server ? stopProcess(server.process) : undefined)));
}

function getStartedServer(result: PromiseSettledResult<SmokeServer>): SmokeServer | undefined {
  return result.status === 'fulfilled' ? result.value : undefined;
}

async function getPage(server: SmokeServer, pathname: string) {
  const response = await fetch(`${server.origin}${pathname}`, {
    headers: { accept: 'text/html' },
  });
  return { status: response.status, html: await response.text() };
}

function getTitle(html: string): string {
  return /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
}

function getH1(html: string): string {
  return /<h1[^>]*>([^<]*)<\/h1>/.exec(html)?.[1] ?? '';
}

function getDescription(html: string): string {
  return /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '';
}

function getRobotsContents(html: string): string[] {
  return [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((match) => match[1]);
}

let up: SmokeServer;
let down: SmokeServer;

beforeAll(async () => {
  if (!existsSync(SERVER_ENTRY)) throw new Error('Run `pnpm build` before `pnpm test:smoke`.');
  const results = await Promise.allSettled([startServer('up'), startServer('down')]);
  const [started, startedDown] = results.map(getStartedServer);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure || !started || !startedDown) {
    await stopServers([started, startedDown]);
    throw failure?.reason ?? new Error('A smoke server did not start');
  }
  up = started;
  down = startedDown;
});

afterAll(async () => {
  await stopServers([up, down]);
});

describe.each([
  { catalogue: 'usgs', id: USGS_ID, place: USGS_PLACE, magnitude: '7.7' },
  { catalogue: 'emsc', id: EMSC_ID, place: EMSC_PLACE, magnitude: '5.1' },
])('$catalogue detail page raw HTML', ({ catalogue, id, place, magnitude }) => {
  it('titles the page with the Magnitude and the place', async () => {
    const { status, html } = await getPage(up, `/en/earthquakes/${catalogue}/${id}`);
    expect(status).toBe(200);
    expect(getTitle(html)).toMatch(new RegExp(`^M${magnitude} earthquake · `));
    expect(getTitle(html)).toContain(place);
    expect(getH1(html)).toBe(place);
    expect(getDescription(html)).toMatch(/^Magnitude .* Depth: .* UTC\. Likely felt up to/);
    expect(html).not.toContain(NOINDEX);
  });

  it('serves the Spanish title and description under /es', async () => {
    const { status, html } = await getPage(up, `/es/earthquakes/${catalogue}/${id}`);
    expect(status).toBe(200);
    expect(getTitle(html)).toMatch(new RegExp(`^Terremoto M${magnitude} · `));
    expect(getDescription(html)).toMatch(/^Terremoto de magnitud .* Profundidad: .* UTC\./);
    expect(html).toContain('<html lang="es"');
  });

  it('answers 404 with the not-found page for an unknown id', async () => {
    const { status, html } = await getPage(up, `/en/earthquakes/${catalogue}/doesnotexist123`);
    expect(status).toBe(404);
    expect(getH1(html)).toBe('Earthquake not found');
    expect(html).toContain(NOINDEX);
  });

  it('does not answer 200 and asks not to be indexed when the agency is down', async () => {
    const { status, html } = await getPage(down, `/en/earthquakes/${catalogue}/${id}`);
    expect(status).not.toBe(200);
    expect(status).toBeGreaterThanOrEqual(500);
    expect(html).toContain(NOINDEX);
    expect(html).toContain('Retry');
  });
});

describe('site indexing flag', () => {
  it.each(['/en', '/en/map', `/en/earthquakes/usgs/${USGS_ID}`])(
    '%s carries the robots tag that VITE_SITE_INDEXABLE asks for',
    async (pathname) => {
      const { html } = await getPage(up, pathname);
      expect(getRobotsContents(html)).toEqual(SITE_ROBOTS);
    },
  );

  it('keeps a single noindex on the not-found page', async () => {
    const { html } = await getPage(up, '/en/earthquakes/usgs/doesnotexist123');
    expect(getRobotsContents(html)).toEqual(['noindex']);
  });
});

describe('escaping', () => {
  it('escapes a place with & and < once in the title and the heading', async () => {
    const { html } = await getPage(up, `/en/earthquakes/usgs/${USGS_ESCAPE_ID}`);
    const escaped = 'Tom &amp; Jerry &lt;Bay&gt;';
    expect(getTitle(html)).toContain(`· ${escaped} ·`);
    expect(getH1(html)).toBe(escaped);
    expect(html).not.toContain(`>${ESCAPE_PLACE}<`);
    expect(html).not.toContain('&amp;amp;');
  });
});

describe('hostile ids', () => {
  it('answers 404 for a script tag as the id without asking the agency', async () => {
    const { status, html } = await getPage(up, '/en/earthquakes/usgs/%3Cscript%3E');
    expect(status).toBe(404);
    expect(getH1(html)).toBe('Earthquake not found');
    expect(html).toContain(NOINDEX);
  });

  it('never lets a place close the script tags, including the dehydrated data', async () => {
    const { status, html } = await getPage(up, `/en/earthquakes/usgs/${USGS_SCRIPT_ID}`);
    expect(status).toBe(200);
    expect(html).toContain('M7.7 earthquake');
    expect(html).not.toContain(SCRIPT_PLACE);
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).not.toContain('<script>alert(1)');
  });
});
