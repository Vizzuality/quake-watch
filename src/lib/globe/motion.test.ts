import { describe, expect, it } from 'vitest';

import {
  getDraggedView,
  getIdleDriftLon,
  getInertiaView,
  getPinchFactor,
  getWheelFactor,
  getZoomedView,
  INITIAL_VIEW,
  LAT_LIMIT,
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
