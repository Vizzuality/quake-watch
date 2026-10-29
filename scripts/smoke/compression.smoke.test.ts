import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { request } from 'node:http';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SERVER_ENTRY, type SmokeServer, startServer, stopProcess } from './server';
import { USGS_ID } from './upstream-double.mjs';

const DETAIL_LINK = 'href="/en/earthquakes/emsc/';
const ASSETS_DIR = path.resolve(import.meta.dirname, '../../.output/public/assets');

type RawResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};

let server: SmokeServer | undefined;

function getRaw(pathname: string, headers: Record<string, string> = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = request(`${server?.origin}${pathname}`, { headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
      );
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

function getServerFnId(): string {
  for (const file of readdirSync(ASSETS_DIR).filter((name) => name.endsWith('.js'))) {
    const id = /\(`([0-9a-f]{64})`\)/.exec(readFileSync(path.join(ASSETS_DIR, file), 'utf8'))?.[1];
    if (id) return id;
  }
  throw new Error('No server function id in the client bundle');
}

function getDetailLinkCount(html: string): number {
  return html.split(DETAIL_LINK).length - 1;
}

beforeAll(async () => {
  if (!existsSync(SERVER_ENTRY)) throw new Error('Run `pnpm build` before `pnpm test:smoke`.');
  server = await startServer('up');
});

afterAll(async () => {
  if (server) await stopProcess(server.process);
});

describe('/en HTML compression', () => {
  it('gzips the page for a client that accepts gzip', async () => {
    const { status, headers, body } = await getRaw('/en', { 'accept-encoding': 'gzip' });
    expect(status).toBe(200);
    expect(headers['content-encoding']).toBe('gzip');
    expect(headers.vary).toMatch(/accept-encoding/i);
    expect(headers['content-length']).toBeUndefined();
    const html = gunzipSync(body).toString('utf8');
    expect(html).toContain('<main');
    expect(getDetailLinkCount(html)).toBeGreaterThanOrEqual(10);
  });

  it('serves plain HTML to a client that sends no accept-encoding', async () => {
    const { status, headers, body } = await getRaw('/en');
    expect(status).toBe(200);
    expect(headers['content-encoding']).toBeUndefined();
    const html = body.toString('utf8');
    expect(html).toContain('<main');
    expect(getDetailLinkCount(html)).toBeGreaterThanOrEqual(10);
  });
});

describe('other responses', () => {
  it('gzips a detail page', async () => {
    const { status, headers, body } = await getRaw(`/en/earthquakes/usgs/${USGS_ID}`, {
      'accept-encoding': 'gzip',
    });
    expect(status).toBe(200);
    expect(headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(body).toString('utf8')).toContain('<main');
  });

  it.each(['/robots.txt', '/sitemap.xml'])('leaves %s uncompressed', async (pathname) => {
    const { status, headers } = await getRaw(pathname, { 'accept-encoding': 'gzip' });
    expect(status).toBe(200);
    expect(headers['content-encoding']).toBeUndefined();
  });

  it('leaves a server function response uncompressed', async () => {
    const { status, headers } = await getRaw(`/_serverFn/${getServerFnId()}`, {
      'accept-encoding': 'gzip',
      'sec-fetch-site': 'same-origin',
      'x-tsr-serverFn': 'true',
    });
    expect(status).toBe(200);
    expect(headers['content-type']).toMatch(/json/);
    expect(headers['content-encoding']).toBeUndefined();
  });
});
