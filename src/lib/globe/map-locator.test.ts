import { describe, expect, it } from 'vitest';

import { MINI_GLOBE_LOOK, getMiniGlobeDots, getMiniGlobeRect } from './map-locator';

const POINTS = Float32Array.from([0, 0, 1, 0, 0, -1, 1, 0, 0, 0, 1, 0]);

describe('getMiniGlobeDots', () => {
  it('turns the globe so the earthquake faces the viewer and hides the far side', () => {
    const dots = getMiniGlobeDots(0, 0, POINTS, Uint8Array.from([1, 1, 1, 1]));

    expect(dots).toHaveLength(1);
    expect(dots[0]).toMatchObject({ alpha: 0.75, isLand: true });
    expect(Math.hypot(dots[0].x, dots[0].y)).toBe(0);
  });

  it('keeps land on every other point and thins the sea to every sixth', () => {
    const points = new Float32Array(12 * 3);
    for (let i = 0; i < 12; i++) points.set([0, 0, 1], i * 3);
    const land = getMiniGlobeDots(0, 0, points, new Uint8Array(12).fill(1));
    const sea = getMiniGlobeDots(0, 0, points, new Uint8Array(12));

    expect(land).toHaveLength(6);
    expect(sea).toHaveLength(2);
    expect(sea[0].alpha).toBeCloseTo(0.25, 6);
  });

  it('flips y so north is up on screen', () => {
    const [north] = getMiniGlobeDots(0, 0, Float32Array.from([0, 0.6, 0.8]), Uint8Array.from([1]));

    expect(north.y).toBeCloseTo(-0.6, 6);
  });
});

describe('getMiniGlobeRect', () => {
  it('draws the visible map area to scale on the 46 px globe', () => {
    const rect = getMiniGlobeRect({ west: -10, east: 10, south: -5, north: 5 }, 0);

    expect(rect.halfWidthPx).toBeCloseTo(Math.sin((10 * Math.PI) / 180) * MINI_GLOBE_LOOK.radiusPx);
    expect(rect.halfHeightPx).toBeCloseTo(Math.sin((5 * Math.PI) / 180) * MINI_GLOBE_LOOK.radiusPx);
  });

  it('never shrinks below 4 px nor grows past a hemisphere', () => {
    expect(getMiniGlobeRect({ west: 0, east: 0.01, south: 0, north: 0.01 }, 0)).toEqual({
      halfWidthPx: 4,
      halfHeightPx: 4,
    });
    const huge = getMiniGlobeRect({ west: -180, east: 180, south: -85, north: 85 }, 0);
    expect(huge.halfWidthPx).toBeCloseTo(Math.sin(1.3) * MINI_GLOBE_LOOK.radiusPx);
  });
});
