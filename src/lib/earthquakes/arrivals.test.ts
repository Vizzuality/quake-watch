import { describe, expect, it } from 'vitest';

import { getArrivedIds } from './arrivals';

describe('getArrivedIds', () => {
  it('marks nothing as new on the first load', () => {
    expect(getArrivedIds(null, ['a', 'b'])).toEqual(new Set());
  });

  it('marks the Earthquakes that were not in the previous refresh', () => {
    expect(getArrivedIds(new Set(['a', 'b']), ['c', 'a', 'b', 'd'])).toEqual(new Set(['c', 'd']));
  });

  it('ignores Earthquakes that dropped out of the window', () => {
    expect(getArrivedIds(new Set(['a', 'b']), ['b'])).toEqual(new Set());
  });
});
