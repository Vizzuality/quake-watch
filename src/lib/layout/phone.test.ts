import { describe, expect, it } from 'vitest';

import {
  PHONE_MAX_WIDTH,
  PHONE_QUERY,
  SIDE_SHEET_WIDTH,
  getPhoneLayout,
  isPhoneViewport,
  isSideViewport,
} from './phone';

const RING_RATIO = 144 / 122;
const RING_LABEL_PX = 30;

describe('phone breakpoint', () => {
  it('derives the phone media query from the md breakpoint: 768 px wide and 480 px tall', () => {
    expect(PHONE_MAX_WIDTH).toBe(768);
    expect(PHONE_QUERY).toBe('(width < 768px), (height < 480px)');
  });

  it.each([
    [390, 844, true, false],
    [320, 640, true, false],
    [844, 390, true, true],
    [740, 360, true, true],
    [640, 400, true, true],
    [1280, 800, false, false],
    [1920, 1080, false, false],
  ])('classifies %ix%i as phone %s and side sheet %s', (width, height, isPhone, isSide) => {
    expect(isPhoneViewport(width, height)).toBe(isPhone);
    expect(isSideViewport(width, height)).toBe(isSide);
  });
});

describe('getPhoneLayout', () => {
  it('matches the Figma frame at 390x844', () => {
    expect(getPhoneLayout(390, 844)).toEqual({
      k: 1,
      isSide: false,
      mapWidth: 390,
      headerBottom: 90,
      homeMapBottom: 548,
      detailMapBottom: 566,
      homeSheetTop: 548,
      homeSheetOpenTop: 128,
      detailSheetTop: 566,
      detailSheetOpenTop: 150,
      detailFocusY: 290,
      globe: { cx: 195, cy: 330, radius: 122 },
    });
  });

  it.each([
    [390, 844],
    [320, 640],
    [320, 568],
  ])('keeps the open home sheet the board gap below the header at %ix%i', (width, height) => {
    const layout = getPhoneLayout(width, height);
    expect(layout.homeSheetOpenTop - layout.headerBottom).toBeGreaterThanOrEqual(38);
  });

  it.each([
    [360, 740, 90, 444, 128, 462, 131.517, 180, 287.744, 106.967],
    [320, 640, 90, 344, 128, 362, 113.744, 160, 217, 82.181],
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

  it.each([
    [844, 390],
    [844, 340],
    [740, 360],
    [640, 400],
  ])('puts the time ring and its labels left of the side sheet at %ix%i', (width, height) => {
    const { isSide, mapWidth, headerBottom, homeMapBottom, globe } = getPhoneLayout(width, height);
    const extent = globe.radius * RING_RATIO;
    expect(isSide).toBe(true);
    expect(mapWidth).toBe(width - SIDE_SHEET_WIDTH);
    expect(homeMapBottom).toBe(height);
    expect(globe.cy - extent - RING_LABEL_PX).toBeGreaterThanOrEqual(headerBottom - 1e-9);
    expect(globe.cy + extent + RING_LABEL_PX).toBeLessThanOrEqual(height + 1e-9);
    expect(globe.cx + extent).toBeLessThanOrEqual(mapWidth);
    expect(globe.radius).toBeGreaterThan(80);
  });
});
