import { existsSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isSiteIndexableFromEnv } from '../../src/lib/seo/indexing';
import { SERVER_ENTRY, type SmokeServer, startServer, stopProcess } from './server';

const SITE_ROBOTS = isSiteIndexableFromEnv(process.env.VITE_SITE_INDEXABLE)
  ? []
  : ['noindex,follow'];

let server: SmokeServer | undefined;

function getRobotsContents(html: string): string[] {
  return [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((match) => match[1]);
}

async function getPage(pathname: string) {
  const response = await fetch(`${server?.origin}${pathname}`, {
    headers: { accept: 'text/html' },
  });
  return { status: response.status, html: await response.text() };
}

beforeAll(async () => {
  if (!existsSync(SERVER_ENTRY)) throw new Error('Run `pnpm build` before `pnpm test:smoke`.');
  server = await startServer('up');
});

afterAll(async () => {
  if (server) await stopProcess(server.process);
});

describe('placeholder shell', () => {
  it.each([
    ['/en', 'en'],
    ['/es', 'es'],
  ])('%s renders the visually hidden heading', async (pathname, locale) => {
    const { status, html } = await getPage(pathname);
    expect(status).toBe(200);
    expect(html).toContain(`<html lang="${locale}"`);
    expect(html).toContain('<h1 class="sr-only">Quake Watch</h1>');
  });
});

describe('site indexing flag', () => {
  it.each(['/en', '/es'])(
    '%s carries the robots tag that VITE_SITE_INDEXABLE asks for',
    async (pathname) => {
      const { html } = await getPage(pathname);
      expect(getRobotsContents(html)).toEqual(SITE_ROBOTS);
    },
  );
});

describe('not-found page', () => {
  it('answers 404 with one line and a link back to the globe', async () => {
    const { status, html } = await getPage('/en/nope');
    expect(status).toBe(404);
    expect(html).toContain('Nothing here.');
    expect(html).toContain('href="/en"');
  });

  it('speaks Spanish under /es', async () => {
    const { status, html } = await getPage('/es/nope');
    expect(status).toBe(404);
    expect(html).toContain('Aquí no hay nada.');
    expect(html).toContain('href="/es"');
  });
});
