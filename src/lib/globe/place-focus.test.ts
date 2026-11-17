import { describe, expect, it } from 'vitest';

import { SELECT_MIN_ZOOM } from './motion';
import { PLACE_MAX_ZOOM, getPlaceFocus } from './place-focus';

describe('getPlaceFocus', () => {
  it('has no focus without Earthquakes', () => {
    expect(getPlaceFocus([])).toBeNull();
  });

  it('centres on a single Earthquake at the closest zoom', () => {
    const focus = getPlaceFocus([{ latitude: -17.7, longitude: 168.3 }]);

    expect(focus?.latitude).toBeCloseTo(-17.7, 6);
    expect(focus?.longitude).toBeCloseTo(168.3, 6);
    expect(focus?.zoom).toBe(PLACE_MAX_ZOOM);
  });

  it('centres across the antimeridian instead of on the far side of the globe', () => {
    const focus = getPlaceFocus([
      { latitude: -18, longitude: 179 },
      { latitude: -18, longitude: -179 },
    ]);

    expect(Math.abs(focus?.longitude ?? 0)).toBeCloseTo(180, 6);
    expect(focus?.latitude).toBeCloseTo(-18, 0);
  });

  it('zooms out for a wide place, never below the select zoom', () => {
    const narrow = getPlaceFocus([
      { latitude: -15, longitude: 167 },
      { latitude: -20, longitude: 169 },
    ]);
    const wide = getPlaceFocus([
      { latitude: 60, longitude: -150 },
      { latitude: -50, longitude: 30 },
    ]);

    expect(narrow?.zoom).toBeLessThanOrEqual(PLACE_MAX_ZOOM);
    expect(narrow?.zoom).toBeGreaterThan(wide?.zoom ?? Infinity);
    expect(wide?.zoom).toBe(SELECT_MIN_ZOOM);
  });
});
