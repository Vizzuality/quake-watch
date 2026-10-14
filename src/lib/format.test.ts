import { describe, expect, it } from 'vitest';

import {
  getCoordinatesLabel,
  getDegreesLabel,
  getSecondsLabel,
  getFullDateTimeLabel,
  getKmLabel,
  getScientificLabel,
  getTimeLabel,
} from './format';

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

describe('getCoordinatesLabel', () => {
  it('uses hemisphere letters instead of signs', () => {
    const point = { latitude: 7.5868, longitude: -80.769 };
    expect(getCoordinatesLabel(point, 'en')).toBe('7.587° N, 80.769° W');
    expect(getCoordinatesLabel({ latitude: -5.4162, longitude: -80.769 }, 'es')).toBe(
      '5,416° S, 80,769° O',
    );
  });
});

describe('getScientificLabel', () => {
  it('writes powers of ten with superscripts', () => {
    expect(getScientificLabel(3.77e20, 'en')).toBe('3.77 × 10²⁰');
    expect(getScientificLabel(1.2e-3, 'es')).toBe('1,2 × 10⁻³');
  });
});

describe('getFullDateTimeLabel', () => {
  it('renders the same instant in the requested time zone', () => {
    const label = getFullDateTimeLabel(Date.parse('2026-08-14T23:04:40Z'), 'en', 'UTC');
    expect(label).toContain('11:04:40');
    expect(label).toContain('UTC');
  });
});

describe('getDegreesLabel and getSecondsLabel', () => {
  it('use compact unit symbols in both locales', () => {
    expect(getDegreesLabel(45, 'en')).toBe('45°');
    expect(getDegreesLabel(45, 'es')).toBe('45°');
    expect(getSecondsLabel(0.84, 'en')).toBe('0.84s');
    expect(getSecondsLabel(0.84, 'es')).toBe('0,84s');
  });
});
