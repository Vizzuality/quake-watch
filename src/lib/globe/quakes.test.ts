import { describe, expect, it } from 'vitest';

import { getDepthRgb } from '../earthquakes/depth-color';
import type { Earthquake } from '../earthquakes/types';
import {
  getEpicentreRadiusPx,
  getHypocentreRadius,
  getHypocentreRadiusPx,
  getQuakeAmplitude,
  getQuakeMarkerAttributes,
  QUAKE_MARKER_LOOK,
} from './quakes';
import { getLatLonVector } from './sphere';

function getEarthquake(overrides: Partial<Earthquake>): Earthquake {
  return {
    id: 'q',
    source: 'usgs',
    magnitude: 5,
    magnitudeType: 'mw',
    place: null,
    time: 0,
    depthKm: 10,
    longitude: 0,
    latitude: 0,
    url: 'https://example.com',
    ...overrides,
  };
}

describe('getHypocentreRadius', () => {
  it.each([
    [0, 1],
    [70, 0.92309],
    [300, 0.67038],
    [600, 0.34076],
    [700, 0.23089],
  ])('places %i km at radius %f', (depthKm, radius) => {
    expect(Math.abs(getHypocentreRadius(depthKm) - radius)).toBeLessThan(1e-4);
  });

  it.each([701, 6371])('caps %i km at the 700 km radius', (depthKm) => {
    expect(Math.abs(getHypocentreRadius(depthKm) - 0.23089)).toBeLessThan(1e-4);
  });

  it.each([-5, Number.NaN])('keeps %f km on the surface', (depthKm) => {
    expect(getHypocentreRadius(depthKm)).toBe(1);
  });
});

describe('quake size', () => {
  it('clamps amplitude at M1 and M9', () => {
    expect(getQuakeAmplitude(1)).toBe(0.12);
    expect(getQuakeAmplitude(9)).toBe(1);
  });

  it('falls back to the minimum amplitude for NaN', () => {
    expect(getQuakeAmplitude(Number.NaN)).toBe(0.12);
  });

  it('draws M6 larger than M3', () => {
    expect(getHypocentreRadiusPx(6)).toBeGreaterThan(getHypocentreRadiusPx(3));
    expect(getHypocentreRadiusPx(6)).toBeCloseTo(2.25, 2);
    expect(getHypocentreRadiusPx(3)).toBeCloseTo(1.16, 2);
  });

  it('sizes the epicentre with the prototype formula', () => {
    expect(getEpicentreRadiusPx(6)).toBeCloseTo((1.3 + 2.2 * getQuakeAmplitude(6)) * 0.5, 10);
  });
});

describe('getQuakeMarkerAttributes', () => {
  const earthquakes = [
    getEarthquake({ latitude: 10, longitude: 20, depthKm: 600, magnitude: 6 }),
    getEarthquake({ latitude: -30, longitude: 140, depthKm: 35, magnitude: 3 }),
  ];
  const { markers, needles } = getQuakeMarkerAttributes(earthquakes);

  it('emits two marker and two needle vertices per Earthquake', () => {
    expect(markers.direction).toHaveLength(12);
    expect(markers.radius).toHaveLength(4);
    expect(markers.size).toHaveLength(4);
    expect(markers.color).toHaveLength(12);
    expect(markers.alpha).toHaveLength(4);
    expect(needles.direction).toHaveLength(12);
    expect(needles.radius).toHaveLength(4);
    expect(needles.color).toHaveLength(12);
    expect(needles.alpha).toHaveLength(4);
  });

  it('puts the epicentre on the surface and the hypocentre at depth', () => {
    expect(markers.radius[0]).toBe(1);
    expect(markers.radius[1]).toBeCloseTo(getHypocentreRadius(600), 6);
    expect(markers.radius[2]).toBe(1);
    expect(markers.radius[3]).toBeCloseTo(getHypocentreRadius(35), 6);
    expect(Array.from(needles.radius)).toEqual(Array.from(markers.radius));
  });

  it('points both vertices along the epicentre direction', () => {
    const direction = getLatLonVector(-30, 140);
    for (const vertex of [2, 3]) {
      direction.forEach((value, axis) => {
        expect(markers.direction[vertex * 3 + axis]).toBeCloseTo(value, 6);
        expect(needles.direction[vertex * 3 + axis]).toBeCloseTo(value, 6);
      });
    }
  });

  it('sizes and fades the markers', () => {
    expect(markers.size[0]).toBeCloseTo(getEpicentreRadiusPx(6), 6);
    expect(markers.size[1]).toBeCloseTo(getHypocentreRadiusPx(6), 6);
    expect(markers.alpha[0]).toBeCloseTo(QUAKE_MARKER_LOOK.epicentreA, 6);
    expect(markers.alpha[1]).toBeCloseTo(QUAKE_MARKER_LOOK.hypocentreA, 6);
    expect(needles.alpha[0]).toBeCloseTo(
      QUAKE_MARKER_LOOK.needleA * QUAKE_MARKER_LOOK.needleBaseK,
      6,
    );
    expect(needles.alpha[1]).toBeCloseTo(QUAKE_MARKER_LOOK.needleA, 6);
  });

  it('colours every vertex by depth', () => {
    const rgb = getDepthRgb(35).map((channel) => channel / 255);
    for (const vertex of [2, 3]) {
      rgb.forEach((value, channel) => {
        expect(markers.color[vertex * 3 + channel]).toBeCloseTo(value, 6);
        expect(needles.color[vertex * 3 + channel]).toBeCloseTo(value, 6);
      });
    }
  });

  it('returns empty arrays for no Earthquakes', () => {
    const empty = getQuakeMarkerAttributes([]);
    expect(empty.markers.direction).toHaveLength(0);
    expect(empty.needles.radius).toHaveLength(0);
  });
});
