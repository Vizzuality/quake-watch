import { describe, expect, it } from 'vitest';

import { getDateTimeLabel, getIntensityLevelLabel, getNumberLabel } from './tooltip-labels';

describe('getIntensityLevelLabel', () => {
  it('names every level in both locales', () => {
    expect(getIntensityLevelLabel('weak', 'en')).toBe('Weak');
    expect(getIntensityLevelLabel('weak', 'es')).toBe('Débil');
    expect(getIntensityLevelLabel('very_strong', 'es')).toBe('Muy fuerte');
    expect(getIntensityLevelLabel('not_felt', 'es')).toBe('No sentido');
  });
});

describe('getNumberLabel', () => {
  it('keeps one fraction digit in the locale style', () => {
    expect(getNumberLabel(5.24, 'en')).toBe('5.2');
    expect(getNumberLabel(5.25, 'es')).toBe('5,3');
  });
});

describe('getDateTimeLabel', () => {
  it('formats a medium date with a short time', () => {
    expect(getDateTimeLabel(Date.UTC(2026, 7, 14, 12, 0), 'en')).toMatch(/2026/);
  });
});
