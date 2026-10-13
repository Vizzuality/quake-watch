import { describe, expect, it } from 'vitest';

import { getEarthquakeCountLabel } from './earthquake-count';

describe('getEarthquakeCountLabel', () => {
  it.each([
    [1, 'en', '1 earthquake'],
    [2, 'en', '2 earthquakes'],
    [1234, 'en', '1,234 earthquakes'],
    [1, 'es', '1 terremoto'],
    [0, 'es', '0 terremotos'],
    [1234, 'es', '1234 terremotos'],
  ] as const)('%i in %s → %s', (count, locale, expected) => {
    expect(getEarthquakeCountLabel(count, locale)).toBe(expected);
  });
});
