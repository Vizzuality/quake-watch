import { describe, expect, it } from 'vitest';

import { EarthquakeSourceError } from './source-error';

describe('EarthquakeSourceError', () => {
  it.each([
    ['emsc', 'EMSC request failed with status 503'],
    ['usgs', 'USGS request failed with status 503'],
  ] as const)('names the %s source and status', (source, message) => {
    const error = new EarthquakeSourceError(source, 503);
    expect(error).toMatchObject({ name: 'EarthquakeSourceError', source, status: 503, message });
  });
});
