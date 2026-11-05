import { existsSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SERVER_ENTRY, type SmokeServer, startServer, stopProcess } from './server';

const ONE_YEAR = 'max-age=31536000';

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
});
