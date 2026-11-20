import { describe, expect, it } from 'vitest';

import { PHONE_MAX_WIDTH, PHONE_QUERY, getPhoneLayout } from './phone';

const RING_RATIO = 144 / 122;
const RING_LABEL_PX = 30;

describe('phone breakpoint', () => {
  it('derives the phone media query from the 768 px Tailwind md breakpoint', () => {
    expect(PHONE_MAX_WIDTH).toBe(768);
    expect(PHONE_QUERY).toBe('(width < 768px)');
  });
});

describe('getPhoneLayout', () => {
  it('matches the Figma frame at 390x844', () => {
    expect(getPhoneLayout(390, 844)).toEqual({
      k: 1,
      headerBottom: 90,
      homeSheetTop: 548,
      homeSheetOpenTop: 128,
      detailSheetTop: 566,
      detailSheetOpenTop: 150,
      detailFocusY: 290,
      globe: { cx: 195, cy: 330, radius: 122 },
    });
  });

  it.each([
    [360, 740, 90, 444, 112.227, 462, 131.517, 180, 287.744, 106.967],
    [320, 640, 90, 344, 97.062, 362, 113.744, 160, 217, 82.181],
  ])(
    'keeps the sheets clear of the bottom at %ix%i',
    (width, height, headerBottom, homeTop, homeOpen, detailTop, detailOpen, cx, cy, radius) => {
      const layout = getPhoneLayout(width, height);
      expect(layout.headerBottom).toBeCloseTo(headerBottom, 2);
      expect(layout.homeSheetTop).toBeCloseTo(homeTop, 2);
      expect(layout.homeSheetOpenTop).toBeCloseTo(homeOpen, 2);
      expect(layout.detailSheetTop).toBeCloseTo(detailTop, 2);
      expect(layout.detailSheetOpenTop).toBeCloseTo(detailOpen, 2);
      expect(layout.globe.cx).toBe(cx);
      expect(layout.globe.cy).toBeCloseTo(cy, 2);
      expect(layout.globe.radius).toBeCloseTo(radius, 2);
    },
  );

  it.each([
    [390, 844],
    [360, 740],
    [320, 640],
  ])('fits the time ring and its labels between header and sheet at %ix%i', (width, height) => {
    const { headerBottom, homeSheetTop, globe } = getPhoneLayout(width, height);
    const extent = globe.radius * RING_RATIO + RING_LABEL_PX;
    expect(globe.cy - extent).toBeGreaterThanOrEqual(headerBottom - 1e-9);
    expect(globe.cy + extent).toBeLessThanOrEqual(homeSheetTop + 1e-9);
  });
});
