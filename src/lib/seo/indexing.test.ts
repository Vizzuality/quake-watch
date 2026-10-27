import { describe, expect, it } from 'vitest';

import { isSiteIndexable, isSiteIndexableFromEnv } from './indexing';

describe('isSiteIndexableFromEnv', () => {
  it('keeps the site out of the index unless the flag is exactly "true"', () => {
    expect(isSiteIndexableFromEnv(undefined)).toBe(false);
    expect(isSiteIndexableFromEnv('')).toBe(false);
    expect(isSiteIndexableFromEnv('false')).toBe(false);
    expect(isSiteIndexableFromEnv('TRUE')).toBe(false);
    expect(isSiteIndexableFromEnv('1')).toBe(false);
  });

  it('opens the site to indexing when the flag is "true"', () => {
    expect(isSiteIndexableFromEnv('true')).toBe(true);
  });
});

describe('isSiteIndexable', () => {
  it('reads the build-time flag', () => {
    expect(isSiteIndexable()).toBe(false);
  });
});
