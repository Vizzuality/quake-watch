import { describe, expect, it } from 'vitest';

import { getLatestEarthquakes } from '@/earthquakes/feed';
import { earthquakesQueryOptions } from '@/earthquakes/queries';

describe('earthquakesQueryOptions', () => {
  it('refetches every 60 seconds', () => {
    expect(earthquakesQueryOptions.refetchInterval).toBe(60_000);
  });

  it('uses a stable query key', () => {
    expect(earthquakesQueryOptions.queryKey).toEqual(['earthquakes', 'm2.5-day']);
  });

  it('fetches with getLatestEarthquakes', () => {
    expect(earthquakesQueryOptions.queryFn).toBe(getLatestEarthquakes);
  });
});
