import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SERVER_ENTRY, type SmokeServer, startServer, stopProcess } from './server';

const ONE_YEAR = 'max-age=31536000';
const SERVER_MANIFEST = path.join(path.dirname(SERVER_ENTRY), 'chunks/virtual/entry.mjs');
const CRUST_PAYLOAD = JSON.stringify({
  t: {
    t: 10,
    i: 0,
    p: {
      k: ['data'],
      v: [
        {
          t: 10,
          i: 1,
          p: {
            k: ['latitude', 'longitude', 'radiusCells'],
            v: [
              { t: 0, s: 35 },
              { t: 0, s: 139 },
              { t: 0, s: 1 },
            ],
          },
          o: 0,
        },
      ],
    },
    o: 0,
  },
  f: 127,
  m: [],
});

let server: SmokeServer | undefined;

async function getCacheControl(pathname: string, headers: Record<string, string> = {}) {
  const response = await fetch(`${server?.origin}${pathname}`, { headers });
  const body = await response.text();
  return {
    status: response.status,
    cacheControl: response.headers.get('cache-control') ?? '',
    body,
  };
}

function getCrustServerFnId(): string {
  const manifest = readFileSync(SERVER_MANIFEST, 'utf8');
  const match = /"([a-f0-9]{64})":\s*\{\s*functionName:\s*"getCrustCells_/.exec(manifest);
  if (!match) throw new Error('getCrustCells server fn id not found in the server manifest');
  return match[1];
}

beforeAll(async () => {
  if (!existsSync(SERVER_ENTRY)) throw new Error('Run `pnpm build` before `pnpm test:smoke`.');
  server = await startServer('up');
});

afterAll(async () => {
  if (server) await stopProcess(server.process);
});

describe('cache headers', () => {
  it('serves hashed /assets/*.js as immutable for a year', async () => {
    const { body: html } = await getCacheControl('/en', { accept: 'text/html' });
    const asset = /\/assets\/[^"']+\.js/.exec(html)?.[0];
    expect(asset).toBeDefined();

    const { status, cacheControl } = await getCacheControl(asset ?? '');
    expect(status).toBe(200);
    expect(cacheControl).toContain(ONE_YEAR);
    expect(cacheControl).toContain('immutable');
  });

  it('does not cache a missing /assets file as immutable', async () => {
    const { status, cacheControl } = await getCacheControl('/assets/does-not-exist.js');
    expect(status).toBe(404);
    expect(cacheControl).not.toContain('immutable');
    expect(cacheControl).not.toContain(ONE_YEAR);
  });

  it('does not mark HTML documents immutable', async () => {
    const { status, cacheControl } = await getCacheControl('/en', { accept: 'text/html' });
    expect(status).toBe(200);
    expect(cacheControl).not.toContain('immutable');
  });

  it('caches the crust server fn GET response for a day', async () => {
    const query = new URLSearchParams({ payload: CRUST_PAYLOAD });
    const { status, cacheControl } = await getCacheControl(
      `/_serverFn/${getCrustServerFnId()}?${query}`,
      { 'x-tsr-serverFn': 'true', 'sec-fetch-site': 'same-origin' },
    );
    expect(status).toBe(200);
    expect(cacheControl).toBe('public, max-age=86400, stale-while-revalidate=604800');
  });
});
