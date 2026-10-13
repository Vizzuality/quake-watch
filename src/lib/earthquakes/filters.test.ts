import { describe, expect, it } from 'vitest';

import { getActiveFilterCount, getWiderPeriod, getWiderRadius } from './filters';
import { earthquakeSearchSchema } from './search-schema';

describe('widening', () => {
  it('steps the radius up and stops at the largest', () => {
    expect(getWiderRadius(100)).toBe(250);
    expect(getWiderRadius(500)).toBeNull();
  });

  it('steps the period up and stops at a year or custom', () => {
    expect(getWiderPeriod('24h')).toBe('7d');
    expect(getWiderPeriod('1y')).toBeNull();
    expect(getWiderPeriod('custom')).toBeNull();
  });
});

describe('getActiveFilterCount', () => {
  it('counts filters that differ from the defaults', () => {
    expect(getActiveFilterCount(earthquakeSearchSchema.parse({}))).toBe(0);
    expect(
      getActiveFilterCount(
        earthquakeSearchSchema.parse({ lat: 1, lon: 1, radius: 250, period: '1y', minmag: 4 }),
      ),
    ).toBe(4);
  });

  it('ignores radius without a place', () => {
    expect(getActiveFilterCount(earthquakeSearchSchema.parse({ radius: 250 }))).toBe(0);
  });
});
