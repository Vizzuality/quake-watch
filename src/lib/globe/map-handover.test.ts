import { describe, expect, it } from 'vitest';

import {
  getMapFade,
  getMapHandoverPadding,
  getMapZoom,
  getMapZoomFromUrl,
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

describe('getMapHandoverPadding', () => {
  it('pads the top when the globe sits below the middle', () => {
    expect(getMapHandoverPadding(1440, 900, { cx: 720, cy: 462 })).toEqual({
      top: 24,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('pads the bottom when the globe sits above the middle', () => {
    expect(getMapHandoverPadding(390, 844, { cx: 195, cy: 330 })).toEqual({
      top: 0,
      bottom: 184,
      left: 0,
      right: 0,
    });
  });

  it('pads the right when the globe sits left of the side sheet', () => {
    expect(getMapHandoverPadding(844, 390, { cx: 262, cy: 221 })).toEqual({
      top: 52,
      bottom: 0,
      left: 0,
      right: 320,
    });
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
