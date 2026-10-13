import { describe, expect, it } from 'vitest';

import { getFeatures } from './feature-collection';

describe('getFeatures', () => {
  it('returns the raw features', () => {
    expect(getFeatures({ type: 'FeatureCollection', features: [1, 2] })).toEqual([1, 2]);
  });

  it('throws when the payload is not a FeatureCollection', () => {
    expect(() => getFeatures({ type: 'Feature' })).toThrow(/Invalid input/);
    expect(() => getFeatures(null)).toThrow(/Invalid input/);
  });
});
