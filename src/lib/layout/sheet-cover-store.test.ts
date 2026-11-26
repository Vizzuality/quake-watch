import { afterEach, describe, expect, it, vi } from 'vitest';

import { getIsMapCovered, setSheetCovering, subscribeSheetCover } from './sheet-cover-store';

describe('sheet cover store', () => {
  afterEach(() => {
    setSheetCovering('a', false);
    setSheetCovering('b', false);
  });

  it('covers the map while any sheet covers it', () => {
    setSheetCovering('a', true);
    setSheetCovering('b', true);
    setSheetCovering('a', false);
    expect(getIsMapCovered()).toBe(true);
    setSheetCovering('b', false);
    expect(getIsMapCovered()).toBe(false);
  });

  it('notifies only when the covered state flips', () => {
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeSheetCover(listener);
    setSheetCovering('a', true);
    setSheetCovering('b', true);
    setSheetCovering('a', false);
    setSheetCovering('b', false);
    unsubscribe();
    setSheetCovering('a', true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
