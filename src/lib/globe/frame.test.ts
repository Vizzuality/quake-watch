import { describe, expect, it } from 'vitest';

import { getGlobeFrame } from './frame';

describe('getGlobeFrame', () => {
  it('matches the board frame at 1440x900', () => {
    expect(getGlobeFrame(1440, 900)).toEqual({ cx: 720, cy: 462, radius: 330, scale: 1 });
  });

  it.each([
    [1920, 1080, 960, 554.4, 396],
    [390, 844, 195, 433.253, 89.375],
    [1024, 768, 512, 394.24, 234.667],
  ])('scales by min(w/1440, h/900) at %ix%i', (width, height, cx, cy, radius) => {
    const frame = getGlobeFrame(width, height);
    expect(frame.cx).toBeCloseTo(cx, 3);
    expect(frame.cy).toBeCloseTo(cy, 3);
    expect(frame.radius).toBeCloseTo(radius, 2);
  });
});
