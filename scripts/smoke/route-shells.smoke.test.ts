import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SERVER_ENTRY, type SmokeServer, startServer, stopProcess } from './server';
import { EMSC_LIST_SIZE } from './upstream-double.mjs';

const UPSTREAM_HOSTS = new Set(['earthquake.usgs.gov', 'www.seismicportal.eu']);
const DETAIL_LINK = 'href="/en/earthquakes/emsc/';

let up: SmokeServer | undefined;
let down: SmokeServer | undefined;
let logDir: string;
let fetchLog: string;

function getListRequests(): URL[] {
  return readFileSync(fetchLog, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => new URL(line))
    .filter((url) => UPSTREAM_HOSTS.has(url.hostname) && !url.searchParams.has('eventid'));
}

async function getPage(server: SmokeServer | undefined, pathname: string) {
  const response = await fetch(`${server?.origin}${pathname}`, {
    headers: { accept: 'text/html' },
  });
  return { status: response.status, html: await response.text() };
}

async function getPageWithListRequests(pathname: string) {
  const before = getListRequests().length;
  const page = await getPage(up, pathname);
  return { ...page, listRequests: getListRequests().slice(before) };
}

function getDetailLinkCount(html: string): number {
  return html.split(DETAIL_LINK).length - 1;
}

beforeAll(async () => {
  if (!existsSync(SERVER_ENTRY)) throw new Error('Run `pnpm build` before `pnpm test:smoke`.');
  logDir = mkdtempSync(path.join(tmpdir(), 'quake-watch-smoke-'));
  fetchLog = path.join(logDir, 'fetch.log');
  writeFileSync(fetchLog, '');
  const [startedUp, startedDown] = await Promise.allSettled([
    startServer('up', { fetchLog }),
    startServer('down'),
  ]);
  if (startedUp.status === 'fulfilled') up = startedUp.value;
  if (startedDown.status === 'fulfilled') down = startedDown.value;
  if (!up || !down) throw new Error('A smoke server did not start');
});

afterAll(async () => {
  await Promise.all([up, down].map((server) => (server ? stopProcess(server.process) : null)));
  rmSync(logDir, { recursive: true, force: true });
});

describe('/en default search', () => {
  it('server-renders the rows and the headline from one upstream request', async () => {
    const { status, html, listRequests } = await getPageWithListRequests('/en');
    expect(status).toBe(200);
    expect(getDetailLinkCount(html)).toBeGreaterThanOrEqual(10);
    expect(html).toContain(`${EMSC_LIST_SIZE} earthquakes worldwide`);
    expect(listRequests.map((url) => url.hostname)).toEqual(['www.seismicportal.eu']);
  });

  it('reuses the server cache for a second request within a minute', async () => {
    const { html, listRequests } = await getPageWithListRequests('/en');
    expect(getDetailLinkCount(html)).toBeGreaterThanOrEqual(10);
    expect(listRequests).toEqual([]);
  });

  it('serves the shell with status 200 when the agency is down', async () => {
    const { status, html } = await getPage(down, '/en');
    expect(status).toBe(200);
    expect(html).toContain('<main');
    expect(getDetailLinkCount(html)).toBe(0);
  });
});

describe.each(['/en', '/en/map'])('%s server-rendered page', (pathname) => {
  it('renders the main landmark, the wordmark and both view tabs', async () => {
    const { status, html } = await getPage(up, pathname);
    expect(status).toBe(200);
    expect(html).toContain('<main');
    expect(html).toMatch(/<h1[^>]*>.*Quake Watch<\/h1>/s);
    expect(html).toContain('href="/en"');
    expect(html).toContain('href="/en/map"');
  });
});

describe.each(['/en?minmag=4', '/en/map'])('%s', (pathname) => {
  it('serves the shell without asking the agency', async () => {
    const { status, html, listRequests } = await getPageWithListRequests(pathname);
    expect(status).toBe(200);
    expect(html).toContain('<main');
    expect(getDetailLinkCount(html)).toBe(0);
    expect(listRequests).toEqual([]);
  });
});
