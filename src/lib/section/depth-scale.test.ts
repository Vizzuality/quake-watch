import { describe, expect, it } from 'vitest';

import { SECTION_FRAME, getDepthScale } from './depth-scale';

describe('section depth scale', () => {
  it('matches the design ticks for earthquakes down to 300 km', () => {
    const scale = getDepthScale(143);

    expect(scale.getY(0)).toBe(330);
    expect(scale.getY(10)).toBe(405);
    expect(scale.getY(100)).toBeCloseTo(490.5);
    expect(scale.getY(200)).toBeCloseTo(585.5);
    expect(scale.getY(300)).toBeCloseTo(680.5);
    expect(scale.bottomY).toBeCloseTo(680.5);
    expect(scale.ticks.map(({ depthKm }) => depthKm)).toEqual([0, 10, 100, 200, 300]);
  });

  it('stretches the top 10 km ×9 and the rest ×1.2 against the horizontal', () => {
    expect(getDepthScale(10).stretch).toEqual({ top: 9, below: 1.2 });
  });

  it('lifts land above sea level at the top-10-km stretch', () => {
    expect(getDepthScale(10).getY(-2)).toBe(315);
  });

  it('squeezes the deep part so a deep earthquake stays in the frame', () => {
    const scale = getDepthScale(593);

    expect(scale.getY(593)).toBeLessThanOrEqual(scale.bottomY);
    expect(scale.bottomY).toBeCloseTo(680.5);
    expect(scale.ticks.at(-1)?.depthKm).toBe(600);
    expect(scale.stretch.below).toBeLessThan(1.2);
  });

  it('spaces deep ticks at least 30 px apart', () => {
    const { ticks } = getDepthScale(700);
    const gaps = ticks.slice(3).map((tick, index) => tick.y - ticks[index + 2].y);

    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(30);
  });

  it('maps 900 km of slice onto the front face', () => {
    const { left, right, centre, getX } = SECTION_FRAME;

    expect(getX(-450)).toBe(left);
    expect(getX(450)).toBe(right);
    expect(getX(0)).toBe(centre);
  });
});
