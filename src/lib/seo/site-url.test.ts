import { describe, expect, it } from 'vitest';

import { getSiteUrl, getSiteUrlFromEnv } from './site-url';

describe('getSiteUrlFromEnv', () => {
  it('falls back to the production origin when unset', () => {
    expect(getSiteUrlFromEnv(undefined)).toBe('https://quake-watch.up.railway.app');
    expect(getSiteUrlFromEnv('')).toBe('https://quake-watch.up.railway.app');
  });

  it('uses the override without its trailing slash', () => {
    expect(getSiteUrlFromEnv('https://example.test/')).toBe('https://example.test');
    expect(getSiteUrlFromEnv('https://example.test')).toBe('https://example.test');
  });
});

describe('getSiteUrl', () => {
  it('reads the build-time constant', () => {
    expect(getSiteUrl()).toBe('https://quake-watch.up.railway.app');
  });
});
