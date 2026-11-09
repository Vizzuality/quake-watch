import { describe, expect, it } from 'vitest';

import { getGlobeFrame } from './frame';

describe('getGlobeFrame', () => {
  it('matches the board frame at 1440x800', () => {
    expect(getGlobeFrame(1440, 800)).toEqual({ cx: 720, cy: 384, radius: 362, scale: 1 });
  });

  it.each([
    [1920, 1080, 960, 518.4, 482.667],
    [1024, 768, 512, 368.64, 257.422],
  ])('scales by min(w/1440, h/800) at %ix%i', (width, height, cx, cy, radius) => {
    const frame = getGlobeFrame(width, height);
    expect(frame.cx).toBeCloseTo(cx, 3);
    expect(frame.cy).toBeCloseTo(cy, 3);
    expect(frame.radius).toBeCloseTo(radius, 2);
  });
});
