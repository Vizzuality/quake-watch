import { describe, expect, it } from 'vitest';

import { getEarthquakeMeaningLabel } from './meaning-labels';

describe('getEarthquakeMeaningLabel', () => {
  it('hedges the Felt reach and keeps the distance on one line', () => {
    expect(getEarthquakeMeaningLabel({ kind: 'felt-reach', reachKm: 180 }, undefined, 'en')).toBe(
      'Likely felt up to ~180 km away',
    );
    expect(getEarthquakeMeaningLabel({ kind: 'felt-reach', reachKm: 1200 }, undefined, 'es')).toBe(
      'Probablemente se sintió hasta a ~1200 km',
    );
  });

  it('says an Earthquake was likely not felt without guessing why', () => {
    expect(getEarthquakeMeaningLabel({ kind: 'not-felt' }, undefined, 'en')).toBe(
      'Likely not felt',
    );
  });

  it('names the estimated Intensity at a named Place of interest', () => {
    expect(
      getEarthquakeMeaningLabel({ kind: 'at-place', roman: 'IV', key: 'light' }, 'Tokyo', 'en'),
    ).toBe('Likely Intensity IV (light) in Tokyo');
    expect(
      getEarthquakeMeaningLabel({ kind: 'at-place', roman: 'I', key: 'not_felt' }, 'Tokyo', 'en'),
    ).toBe('Likely not felt in Tokyo');
  });

  it('refers to an unnamed center as the selected point, not the reader', () => {
    expect(
      getEarthquakeMeaningLabel({ kind: 'at-place', roman: 'II', key: 'weak' }, undefined, 'es'),
    ).toBe('Probablemente intensidad II (débil) en el punto elegido');
    expect(
      getEarthquakeMeaningLabel({ kind: 'at-place', roman: 'I', key: 'not_felt' }, undefined, 'en'),
    ).toBe('Likely not felt at the selected point');
  });
});
