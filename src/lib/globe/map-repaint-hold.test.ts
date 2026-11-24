import { describe, expect, it } from 'vitest';

import { holdMapRepaints } from './map-repaint-hold';

class FakeMap {
  frames = 0;

  triggerRepaint() {
    this.frames += 1;
  }

  redraw() {
    this.frames += 1;
    return this;
  }
}

describe('holdMapRepaints', () => {
  it('draws nothing while held', () => {
    const map = new FakeMap();
    holdMapRepaints(map);

    map.triggerRepaint();
    map.redraw();

    expect(map.frames).toBe(0);
  });

  it('draws once on release when a repaint was asked for', () => {
    const map = new FakeMap();
    const release = holdMapRepaints(map);

    map.triggerRepaint();
    map.triggerRepaint();
    release();

    expect(map.frames).toBe(1);
  });

  it('draws nothing on release when no repaint was asked for', () => {
    const map = new FakeMap();
    holdMapRepaints(map)();

    expect(map.frames).toBe(0);
  });

  it('restores the map’s own repaints after release', () => {
    const map = new FakeMap();
    holdMapRepaints(map)();

    map.triggerRepaint();

    expect(map.frames).toBe(1);
    expect(Object.hasOwn(map, 'triggerRepaint')).toBe(false);
    expect(Object.hasOwn(map, 'redraw')).toBe(false);
  });
});
