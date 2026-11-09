import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isSiteIndexableFromEnv } from '../../src/lib/seo/indexing';
import { SERVER_ENTRY, type SmokeServer, startServer, stopProcess } from './server';

const SITE_ROBOTS = isSiteIndexableFromEnv(process.env.VITE_SITE_INDEXABLE)
  ? []
  : ['noindex,follow'];

const THREE_MARKER = 'THREE.WebGLRenderer';
const ASSETS_DIR = path.join(path.dirname(SERVER_ENTRY), '../public/assets');

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

async function getRedirect(pathname: string) {
  const response = await fetch(`${server?.origin}${pathname}`, {
    headers: { accept: 'text/html' },
    redirect: 'manual',
  });
  const target = new URL(response.headers.get('location') ?? '', server?.origin);
  return { status: response.status, target: `${target.pathname}${target.search}` };
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

describe('globe first paint', () => {
  it('builds three.js into its own lazy globe chunk', () => {
    const chunks = readdirSync(ASSETS_DIR).filter((name) => /^globe-[\w-]+\.js$/.test(name));
    expect(chunks).toHaveLength(1);
    expect(readFileSync(path.join(ASSETS_DIR, chunks[0]), 'utf8')).toContain(THREE_MARKER);
  });

  it('server-renders the shell without a canvas or any three.js code in the first-paint scripts', async () => {
    const { status, html } = await getPage('/en');
    expect(status).toBe(200);
    expect(html).not.toContain('<canvas');
    expect(html).not.toMatch(/\/assets\/globe-/);
    const scripts = [...new Set(html.match(/\/assets\/[\w.-]+\.js/g))];
    expect(scripts.length).toBeGreaterThan(0);
    const scriptsWithThree = [];
    for (const script of scripts) {
      const response = await fetch(`${server?.origin}${script}`);
      if ((await response.text()).includes(THREE_MARKER)) scriptsWithThree.push(script);
    }
    expect(scriptsWithThree).toEqual([]);
  });
});

describe('web fonts', () => {
  it('self-hosts Space Grotesk and ships no Inter Tight or Geist Mono to the browser', async () => {
    const { status, html } = await getPage('/en');
    expect(status).toBe(200);
    expect(html).not.toContain('fonts.googleapis.com');
    const stylesheets = [...new Set(html.match(/\/assets\/[\w.-]+\.css/g))];
    expect(stylesheets.length).toBeGreaterThan(0);
    let css = '';
    for (const stylesheet of stylesheets) {
      css += await (await fetch(`${server?.origin}${stylesheet}`)).text();
    }
    for (const weight of [300, 400, 500, 700]) {
      expect(css).toMatch(new RegExp(`space-grotesk-latin-${weight}-normal[\\w-]*\\.woff2`));
    }
    expect(css).not.toMatch(/inter-tight|geist-mono/i);
    expect(
      readdirSync(ASSETS_DIR).filter((name) =>
        /inter-tight|geist-mono|space-grotesk-[\w-]+-600-/.test(name),
      ),
    ).toEqual([]);
  });
});

describe('globe search params', () => {
  it('restores the filters from the URL on the placeholder', async () => {
    const { status, html } = await getPage('/en?interval=3d&minmag=5&depth=deep&source=usgs');
    expect(status).toBe(200);
    expect(html).toContain('data-source="usgs"');
    expect(html).toContain('data-interval="3d"');
    expect(html).toContain('data-minmag="5"');
    expect(html).toContain('data-depth="deep"');
  });

  it.each(['/en?zoom=abc&depth=foo', '/en?interval=7d'])(
    '%s redirects to the canonical URL',
    async (pathname) => {
      expect(await getRedirect(pathname)).toEqual({ status: 307, target: '/en' });
    },
  );

  it('renders the default view after following the invalid-params redirect', async () => {
    const { status, html } = await getPage('/en?zoom=abc&depth=foo');
    expect(status).toBe(200);
    expect(html).toContain('data-depth="all"');
  });
});

describe('earthquake list prefetch', () => {
  it('renders the globe without fetching or embedding the list on the server', async () => {
    for (const pathname of ['/en', '/en?interval=24h&depth=deep&source=usgs']) {
      const { status, html } = await getPage(pathname);
      expect(status).toBe(200);
      expect(html).not.toContain('smokelistsentinel');
    }
    expect(readFileSync(server?.upstreamLog ?? '', 'utf8')).toBe('');
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
