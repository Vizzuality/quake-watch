import { describe, expect, it } from 'vitest';

import {
  getMapFade,
  getMapPaddingTop,
  getMapZoom,
  getMapZoomFromUrl,
  getQuakeMapRadiusPx,
  getUrlZoom,
} from './map-handover';

describe('getMapZoom', () => {
  it.each([
    [1650, 0, 4.34],
    [1650, 40, 3.955],
    [446.9, 0, 2.455],
  ])('matches a %f px globe at latitude %f', (radius, latitude, zoom) => {
    expect(getMapZoom(radius, latitude)).toBeCloseTo(zoom, 2);
  });
});

describe('URL zoom', () => {
  it('reads 5 at the handover zoom', () => {
    expect(getUrlZoom(3.955, 3.955)).toBe(5);
  });

  it('counts map zoom levels past the handover', () => {
    expect(getUrlZoom(6.5, 4.5)).toBe(7);
  });

  it('round-trips through the map zoom', () => {
    expect(getMapZoomFromUrl(getUrlZoom(9.25, 4.34), 4.34)).toBeCloseTo(9.25, 10);
  });

  it('opens a globe-range zoom at the handover', () => {
    expect(getMapZoomFromUrl(3, 4.34)).toBe(4.34);
  });
});

describe('getQuakeMapRadiusPx', () => {
  it.each([
    [Number.NaN, 4.36],
    [2, 4.36],
    [6.4, 7],
    [9, 7],
  ])('sizes magnitude %f to %f px', (magnitude, radius) => {
    expect(getQuakeMapRadiusPx(magnitude)).toBeCloseTo(radius, 2);
  });
});

describe('getMapPaddingTop', () => {
  it('moves the map centre onto the globe centre', () => {
    expect(getMapPaddingTop(900, 462)).toBe(24);
  });
});

describe('getMapFade', () => {
  it.each([
    [4, 0],
    [4.5, 0],
    [4.75, 0.5],
    [5, 1],
  ])('shows the map at globe zoom %f with opacity %f', (zoom, opacity) => {
    expect(getMapFade(zoom)).toBeCloseTo(opacity, 6);
  });
});
