import { describe, expect, it } from 'vitest';

import { getKmLabel, getTimeLabel } from './format';

const NOW = Date.parse('2026-10-08T12:00:00.000Z');

describe('getTimeLabel', () => {
  it('is relative within 24 h', () => {
    expect(getTimeLabel(NOW - 30 * 60_000, NOW, 'en')).toBe('30 minutes ago');
    expect(getTimeLabel(NOW - 3 * 3_600_000, NOW, 'es')).toBe('hace 3 horas');
  });

  it('is absolute after 24 h', () => {
    const label = getTimeLabel(Date.parse('2026-08-14T23:04:40Z'), NOW, 'en', 'UTC');
    expect(label).toContain('2026');
    expect(label).toContain('11:04');
  });
});

describe('getKmLabel', () => {
  it('formats kilometres in the locale', () => {
    expect(getKmLabel(1234.4, 'en')).toBe('1,234 km');
    expect(getKmLabel(2.1, 'es', 1)).toBe('2,1 km');
  });
});
