import { describe, expect, it } from 'vitest';

import { placeSuggestionsQueryOptions } from './query-options';

describe('placeSuggestionsQueryOptions', () => {
  it('stays disabled under three characters', () => {
    expect(placeSuggestionsQueryOptions('gr').enabled).toBe(false);
    expect(placeSuggestionsQueryOptions('  gr  ').enabled).toBe(false);
    expect(placeSuggestionsQueryOptions('gra').enabled).toBe(true);
  });

  it('shares one cache entry per normalised text', () => {
    expect(placeSuggestionsQueryOptions(' Granada ').queryKey).toEqual(
      placeSuggestionsQueryOptions('granada').queryKey,
    );
  });

  it('never goes stale', () => {
    expect(placeSuggestionsQueryOptions('granada').staleTime).toBe(Infinity);
  });

  it('does not retry a failed or rate-limited lookup', () => {
    expect(placeSuggestionsQueryOptions('granada').retry).toBe(false);
  });
});
