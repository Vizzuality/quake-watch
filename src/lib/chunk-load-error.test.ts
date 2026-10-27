import { describe, expect, it } from 'vitest';

import { isChunkLoadError } from './chunk-load-error';

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://example.com/assets/map.js',
    'Importing a module script failed.',
    'Loading chunk 12 failed.',
    'Unable to preload CSS for /assets/map.css',
  ])('recognises %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});
