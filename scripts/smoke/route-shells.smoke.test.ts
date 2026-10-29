import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SERVER_ENTRY, type SmokeServer, startServer, stopProcess } from './server';

const UPSTREAM_HOSTS = new Set(['earthquake.usgs.gov', 'www.seismicportal.eu']);

let server: SmokeServer | undefined;
let logDir: string;
let fetchLog: string;

function getListRequests(): string[] {
  return readFileSync(fetchLog, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => new URL(line))
    .filter((url) => UPSTREAM_HOSTS.has(url.hostname) && !url.searchParams.has('eventid'))
    .map((url) => url.href);
}

beforeAll(async () => {
  if (!existsSync(SERVER_ENTRY)) throw new Error('Run `pnpm build` before `pnpm test:smoke`.');
  logDir = mkdtempSync(path.join(tmpdir(), 'quake-watch-smoke-'));
  fetchLog = path.join(logDir, 'fetch.log');
  writeFileSync(fetchLog, '');
  server = await startServer('up', { fetchLog });
});

afterAll(async () => {
  if (server) await stopProcess(server.process);
  rmSync(logDir, { recursive: true, force: true });
});

describe.each(['/en', '/en/map'])('%s server-rendered shell', (pathname) => {
  it('renders the main landmark, the wordmark and both view tabs', async () => {
    const response = await fetch(`${server?.origin}${pathname}`, {
      headers: { accept: 'text/html' },
    });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('<main');
    expect(html).toMatch(/<h1[^>]*>.*Quake Watch<\/h1>/s);
    expect(html).toContain('href="/en"');
    expect(html).toContain('href="/en/map"');
    expect(getListRequests()).toEqual([]);
  });
});
