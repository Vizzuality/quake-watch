import { describe, expect, it } from 'vitest';

import { getFeltReadoutText, getFeltStrongestText } from './felt-reports-labels';

describe('getFeltReadoutText', () => {
  it.each([
    [1, 'en', 'Intensity VI · Strong — 1 report'],
    [48, 'en', 'Intensity VI · Strong — 48 reports'],
    [1, 'es', 'Intensidad VI · Strong — 1 informe'],
    [48, 'es', 'Intensidad VI · Strong — 48 informes'],
  ] as const)('%i in %s → %s', (count, locale, expected) => {
    expect(getFeltReadoutText('VI · Strong', count, locale)).toBe(expected);
  });
});

describe('getFeltStrongestText', () => {
  it.each([
    [1, 'en', 'X · Extreme (1 report)'],
    [3, 'en', 'X · Extreme (3 reports)'],
    [1234, 'en', 'X · Extreme (1,234 reports)'],
    [1, 'es', 'X · Extreme (1 informe)'],
    [3, 'es', 'X · Extreme (3 informes)'],
  ] as const)('%i in %s → %s', (count, locale, expected) => {
    expect(getFeltStrongestText('X · Extreme', count, locale)).toBe(expected);
  });
});
