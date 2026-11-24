import { afterEach, describe, expect, it, vi } from 'vitest';

import { getIsSectionShown, setSectionShown, subscribeSectionShown } from './section-shown-store';

describe('section shown store', () => {
  afterEach(() => setSectionShown(false));

  it('starts hidden', () => {
    expect(getIsSectionShown()).toBe(false);
  });

  it('notifies subscribers when the section shows and hides', () => {
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeSectionShown(listener);

    setSectionShown(true);
    expect(getIsSectionShown()).toBe(true);
    setSectionShown(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setSectionShown(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stays quiet when the state does not change', () => {
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeSectionShown(listener);

    setSectionShown(false);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
