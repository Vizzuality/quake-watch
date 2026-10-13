import type { MapGeoJSONFeature } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { getIsEpicenterVisible, getVisibleEpicenterId } from './epicenter-hit';

const CLOCK = { getRange: () => ({ start: 100, end: 900 }), getT: () => 500 };

function getMap(times: number[], hasLayer = true) {
  const features = times.map((time, index) => ({
    properties: { id: `q${index}`, time },
  })) as unknown as MapGeoJSONFeature[];
  return {
    getLayer: () => (hasLayer ? ({} as never) : undefined),
    queryRenderedFeatures: () => features,
  };
}

describe('getVisibleEpicenterId', () => {
  it('returns the topmost earthquake inside the window', () => {
    expect(getVisibleEpicenterId(getMap([300, 400]), [0, 0], CLOCK)).toBe('q0');
  });

  it('skips earthquakes before the window start and after t', () => {
    expect(getVisibleEpicenterId(getMap([50, 600, 300]), [0, 0], CLOCK)).toBe('q2');
    expect(getVisibleEpicenterId(getMap([50, 600]), [0, 0], CLOCK)).toBeNull();
  });

  it('returns null when the layer is missing', () => {
    expect(getVisibleEpicenterId(getMap([300], false), [0, 0], CLOCK)).toBeNull();
  });
});

describe('getIsEpicenterVisible', () => {
  it('includes both ends of [start, t]', () => {
    expect(getIsEpicenterVisible(100, CLOCK)).toBe(true);
    expect(getIsEpicenterVisible(500, CLOCK)).toBe(true);
    expect(getIsEpicenterVisible(501, CLOCK)).toBe(false);
  });
});
