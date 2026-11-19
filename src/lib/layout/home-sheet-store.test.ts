import { afterEach, describe, expect, it, vi } from 'vitest';

import { getIsHomeSheetOpen, setHomeSheetOpen, subscribeHomeSheet } from './home-sheet-store';

describe('home sheet store', () => {
  afterEach(() => setHomeSheetOpen(false));

  it('starts collapsed', () => {
    expect(getIsHomeSheetOpen()).toBe(false);
  });

  it('notifies subscribers when the sheet opens and closes', () => {
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeHomeSheet(listener);

    setHomeSheetOpen(true);
    expect(getIsHomeSheetOpen()).toBe(true);
    setHomeSheetOpen(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setHomeSheetOpen(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stays quiet when the state does not change', () => {
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeHomeSheet(listener);

    setHomeSheetOpen(false);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
