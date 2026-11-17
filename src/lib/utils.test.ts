import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { TEXT_SIZE_TOKENS, cn } from './utils';

describe('cn', () => {
  it('keeps a type token next to a colour token', () => {
    expect(cn('text-caption text-muted')).toBe('text-caption text-muted');
  });

  it('lets a later type token replace an earlier one', () => {
    expect(cn('text-caption', 'text-title')).toBe('text-title');
  });

  it('knows every type token defined in styles.css', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
    const tokens = [...css.matchAll(/^\s+--text-([a-z0-9-]+?):/gm)]
      .map(([, name]) => name)
      .filter((name) => !name.includes('--'));

    expect([...TEXT_SIZE_TOKENS].sort()).toEqual([...new Set(tokens)].sort());
  });
});
