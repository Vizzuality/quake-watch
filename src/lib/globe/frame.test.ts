import { describe, expect, it } from 'vitest';

import { getGlobeFrame } from './frame';

describe('getGlobeFrame', () => {
  it('matches the board frame at 1440x900', () => {
    expect(getGlobeFrame(1440, 900)).toEqual({ cx: 720, cy: 462, radius: 330, scale: 1 });
  });

  it.each([
    [1920, 1080, 960, 554.4, 396],
    [1024, 768, 512, 394.24, 234.667],
  ])('scales by min(w/1440, h/900) at %ix%i', (width, height, cx, cy, radius) => {
    const frame = getGlobeFrame(width, height);
    expect(frame.cx).toBeCloseTo(cx, 3);
    expect(frame.cy).toBeCloseTo(cy, 3);
    expect(frame.radius).toBeCloseTo(radius, 2);
  });

  it('frames the phone globe above the sheet at 390x844', () => {
    expect(getGlobeFrame(390, 844)).toEqual({ cx: 195, cy: 330, radius: 122, scale: 144 / 354 });
  });

  it('keeps the phone ring proportional to the globe at 320x640', () => {
    const frame = getGlobeFrame(320, 640);
    expect(frame.scale * 354).toBeCloseTo((frame.radius * 144) / 122, 6);
  });

  it('uses the desktop frame from 768 px wide', () => {
    expect(getGlobeFrame(768, 1024).radius).toBeCloseTo(330 * (768 / 1440), 6);
  });
});
