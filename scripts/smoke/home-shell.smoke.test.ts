import { existsSync, readFileSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SERVER_ENTRY, type SmokeServer, startServer, stopProcess } from './server';
import { SMOKE_LIST_SENTINEL } from './upstream-double.mjs';

const WORDMARK = 'viewBox="0 0 159 16"';
const FILTER_OPTIONS = ['24h', '3d', '7d', 'All', '3+', '6+', 'Shallow', 'Deep', 'USGS', 'EMSC'];

let up: SmokeServer;
let down: SmokeServer;

async function getPage(server: SmokeServer, pathname: string) {
  const response = await fetch(`${server.origin}${pathname}`, { headers: { accept: 'text/html' } });
  return { status: response.status, html: await response.text() };
}

function getListRequests(server: SmokeServer): string[] {
  return readFileSync(server.upstreamLog, 'utf8').split('\n').filter(Boolean);
}

function expectShell(html: string) {
  expect(html).toContain('<main');
  expect(html).toContain(WORDMARK);
  expect(html).toContain('aria-label="Filters"');
  for (const option of FILTER_OPTIONS) expect(html).toContain(`>${option}</span>`);
}

beforeAll(async () => {
  if (!existsSync(SERVER_ENTRY)) throw new Error('Run `pnpm build` before `pnpm test:smoke`.');
  [up, down] = await Promise.all([startServer('up'), startServer('down')]);
});

afterAll(async () => {
  await Promise.all([up, down].map((server) => (server ? stopProcess(server.process) : undefined)));
});

describe('server-rendered home shell', () => {
  it('renders the wordmark, the Filters panel and the Summary of the week', async () => {
    const { status, html } = await getPage(up, '/en');

    expect(status).toBe(200);
    expectShell(html);
    expect(html).toContain(
      'data-testid="summary-count" class="text-stat md:text-numeral-l">2</span>',
    );
    expect(html).toContain('earthquakes this week.');
    expect(html).toContain('Likely felt');
    expect(html).toContain('Largest · Southern Spain');
  });

  it('hands the fetched list to the client and reuses it across requests', async () => {
    const before = getListRequests(up).length;
    const { html } = await getPage(up, '/en');

    expect(html).toContain(SMOKE_LIST_SENTINEL);
    expect(getListRequests(up)).toHaveLength(before);
  });

  it('fetches the list for the filters in the URL', async () => {
    const { status, html } = await getPage(up, '/en?interval=24h&source=usgs');

    expect(status).toBe(200);
    expect(html).toContain('earthquakes in the last 24 hours.');
    expect(getListRequests(up).at(-1)).toMatch(/^https:\/\/earthquake\.usgs\.gov\//);
  });

  it('still renders the shell without a Summary when the agency is down', async () => {
    const { status, html } = await getPage(down, '/en');

    expect(status).toBe(200);
    expectShell(html);
    expect(html).not.toContain('data-testid="summary"');
    expect(html).not.toContain(SMOKE_LIST_SENTINEL);
  });
});
