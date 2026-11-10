import { describe, expect, it } from 'vitest';

import {
  FLY_DURATION_MS,
  getCenteredView,
  getDraggedView,
  getFlyView,
  getIdleDriftLon,
  getInertiaView,
  getPinchFactor,
  getWheelFactor,
  getZoomedView,
  INITIAL_VIEW,
  LAT_LIMIT,
  SELECT_MIN_ZOOM,
  ZOOM_RANGE,
} from './motion';

describe('motion', () => {
  it('starts at lon 150°, lat 0.12, zoom 1', () => {
    expect(INITIAL_VIEW).toEqual({ lon: (150 * Math.PI) / 180, lat: 0.12, zoom: 1 });
    expect(ZOOM_RANGE).toEqual([1, 5]);
    expect(LAT_LIMIT).toBe(1.45);
  });

  it('drags with k = 1/(radius·zoom) and board signs', () => {
    const view = getDraggedView({ lon: 1, lat: 0, zoom: 2 }, 100, 50, 362);
    expect(view.lon).toBeCloseTo(1 - 100 / 724);
    expect(view.lat).toBeCloseTo(50 / 724);
    expect(view.zoom).toBe(2);
  });

  it('clamps latitude to ±1.45', () => {
    expect(getDraggedView(INITIAL_VIEW, 0, 10_000, 362).lat).toBe(1.45);
    expect(getDraggedView(INITIAL_VIEW, 0, -10_000, 362).lat).toBe(-1.45);
  });

  it('zooms by wheel and pinch factors, clamped to 1–5', () => {
    expect(getWheelFactor(-100)).toBeCloseTo(Math.exp(0.15));
    expect(getPinchFactor(300, 200)).toBe(1.5);
    let view = INITIAL_VIEW;
    for (let i = 0; i < 20; i++) view = getZoomedView(view, getWheelFactor(-100));
    expect(view.zoom).toBe(5);
    for (let i = 0; i < 20; i++) view = getZoomedView(view, getWheelFactor(100));
    expect(view.zoom).toBe(1);
  });

  it('stops a 3 rad/s flick within 1 s at 60 fps', () => {
    let state = { view: INITIAL_VIEW, velocity: { lon: 3, lat: 0 } };
    let frames = 0;
    while (state.velocity.lon !== 0 && frames < 120) {
      state = getInertiaView(state.view, state.velocity, 1 / 60);
      frames++;
    }
    expect(frames / 60).toBeLessThanOrEqual(1);
    expect(state.view.lon).toBeGreaterThan(INITIAL_VIEW.lon);
    expect(state.velocity).toEqual({ lon: 0, lat: 0 });
  });

  it('clamps latitude during inertia', () => {
    const { view } = getInertiaView({ lon: 0, lat: 1.44, zoom: 1 }, { lon: 0, lat: 3 }, 0.1);
    expect(view.lat).toBe(1.45);
  });

  it('drifts longitude with the board Live formula', () => {
    expect(getIdleDriftLon(1, 0.5, 0)).toBeCloseTo(1 + 0.5 * 0.0133);
    expect(getIdleDriftLon(1, 0.5, 9000 * Math.PI)).toBeCloseTo(1 - 0.5 * 0.0133);
  });
});

describe('getCenteredView', () => {
  it('centres on the quake in radians and zooms in to at least 1.6', () => {
    expect(FLY_DURATION_MS).toBe(900);
    expect(SELECT_MIN_ZOOM).toBe(1.6);
    const view = getCenteredView(35, 139, { lon: 2, lat: 0, zoom: 1 });
    expect(view.lon).toBeCloseTo((139 * Math.PI) / 180, 12);
    expect(view.lat).toBeCloseTo((35 * Math.PI) / 180, 12);
    expect(view.zoom).toBe(1.6);
  });

  it('keeps a closer zoom and clamps it at 5', () => {
    expect(getCenteredView(0, 0, { lon: 0, lat: 0, zoom: 3 }).zoom).toBe(3);
    expect(getCenteredView(0, 0, { lon: 0, lat: 0, zoom: 7 }).zoom).toBe(5);
  });

  it('takes the short way across ±180°', () => {
    const view = getCenteredView(0, -179, { lon: 3.1, lat: 0, zoom: 1 });
    expect(view.lon).toBeCloseTo(2 * Math.PI - (179 * Math.PI) / 180, 12);
    expect(view.lon).toBeCloseTo(3.159, 3);
    expect(Math.abs(view.lon - 3.1)).toBeLessThan(0.1);
  });

  it('unwraps to the turn nearest the current longitude', () => {
    const view = getCenteredView(0, 10, { lon: 4 * Math.PI, lat: 0, zoom: 1 });
    expect(view.lon).toBeCloseTo(4 * Math.PI + (10 * Math.PI) / 180, 12);
  });

  it('clamps latitude to ±1.45', () => {
    expect(getCenteredView(89, 0, INITIAL_VIEW).lat).toBe(LAT_LIMIT);
    expect(getCenteredView(-89, 0, INITIAL_VIEW).lat).toBe(-LAT_LIMIT);
  });
});

describe('getFlyView', () => {
  const from = { lon: 0, lat: 0.2, zoom: 1 };
  const to = { lon: 2, lat: -0.6, zoom: 3 };

  it('starts at the origin and ends at the target', () => {
    expect(getFlyView(from, to, 0)).toEqual(from);
    expect(getFlyView(from, to, 1)).toEqual(to);
  });

  it('is halfway at the midpoint and eases in and out', () => {
    const middle = getFlyView(from, to, 0.5);
    expect(middle.lon).toBeCloseTo(1);
    expect(middle.lat).toBeCloseTo(-0.2);
    expect(middle.zoom).toBeCloseTo(2);
    expect(getFlyView(from, to, 0.25).lon).toBeCloseTo(0.25);
    expect(getFlyView(from, to, 0.75).lon).toBeCloseTo(1.75);
  });

  it('clamps progress outside 0..1', () => {
    expect(getFlyView(from, to, -1)).toEqual(from);
    expect(getFlyView(from, to, 2)).toEqual(to);
  });
});
