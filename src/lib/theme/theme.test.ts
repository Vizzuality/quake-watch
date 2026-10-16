import { describe, expect, it } from 'vitest';

import { getResolvedTheme, getThemePreference } from './theme';

describe('getThemePreference', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['system', 'system'],
    [null, 'system'],
    ['sepia', 'system'],
  ] as const)('reads %s as %s', (stored, expected) => {
    expect(getThemePreference(stored)).toBe(expected);
  });
});

describe('getResolvedTheme', () => {
  it('follows the device when the preference is system', () => {
    expect(getResolvedTheme('system', true)).toBe('dark');
    expect(getResolvedTheme('system', false)).toBe('light');
  });

  it('ignores the device when the preference is explicit', () => {
    expect(getResolvedTheme('light', true)).toBe('light');
    expect(getResolvedTheme('dark', false)).toBe('dark');
  });
});
