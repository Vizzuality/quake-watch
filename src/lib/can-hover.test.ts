import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCanHover } from './can-hover';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCanHover', () => {
  it.each([true, false])('reports (hover: hover) = %s', (matches) => {
    const matchMedia = vi.fn<(query: string) => { matches: boolean }>(() => ({ matches }));
    vi.stubGlobal('window', { matchMedia });
    expect(getCanHover()).toBe(matches);
    expect(matchMedia).toHaveBeenCalledWith('(hover: hover)');
  });
});
