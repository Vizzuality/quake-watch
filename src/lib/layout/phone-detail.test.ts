import { describe, expect, it } from 'vitest';

import { getPhoneLayout } from './phone';
import {
  getDetailSheetOpenTop,
  getMapSheetTopStyle,
  getPhoneDetailOverlay,
  getPhoneDetailOverlayStyle,
  getPhoneFeltLabelPlacement,
  getPhoneStripLabelLeft,
  getPhoneTickLabelsShown,
} from './phone-detail';

const MINI_GLOBE_BOX_PX = 100;
const STRIP_HEIGHT_PX = 111;

describe('getPhoneDetailOverlay', () => {
  it('places the mini-globe at (352, 164) with radius 22, and the strip and scale bar above the sheet on 390 × 844', () => {
    const overlay = getPhoneDetailOverlay(getPhoneLayout(390, 844));

    expect(overlay.miniGlobe.top + MINI_GLOBE_BOX_PX / 2).toBe(164);
    expect(390 - overlay.miniGlobe.right - MINI_GLOBE_BOX_PX / 2).toBe(352);
    expect(overlay.miniGlobe.scale * 46).toBeCloseTo(22, 6);
    expect(overlay.stripTop + STRIP_HEIGHT_PX).toBeLessThan(566);
    expect(overlay.stripTop + STRIP_HEIGHT_PX).toBeGreaterThanOrEqual(556);
    expect(overlay.scaleBarTop).toBeLessThan(overlay.stripTop);
  });

  it('scales the mini-globe with the phone scale and keeps it under the action row at 320 × 640', () => {
    const layout = getPhoneLayout(320, 640);
    const overlay = getPhoneDetailOverlay(layout);
    const radius = overlay.miniGlobe.scale * 46;
    const centreY = overlay.miniGlobe.top + MINI_GLOBE_BOX_PX / 2;
    const centreX = 320 - overlay.miniGlobe.right - MINI_GLOBE_BOX_PX / 2;

    expect(radius).toBeCloseTo(22 * layout.k, 6);
    expect(centreY - radius).toBeGreaterThan(128);
    expect(centreX + radius).toBeLessThanOrEqual(320 - 12);
    expect(overlay.stripTop + STRIP_HEIGHT_PX).toBeLessThan(layout.detailSheetTop);
    expect(overlay.scaleBarTop).toBeGreaterThan(centreY + radius);
  });
});

describe('getPhoneDetailOverlayStyle', () => {
  it('exposes the phone positions as CSS variables in px', () => {
    const layout = getPhoneLayout(390, 844);
    const { miniGlobe, scaleBarTop, stripTop } = getPhoneDetailOverlay(layout);

    expect(getPhoneDetailOverlayStyle(layout)).toEqual({
      '--mini-globe-top': `${miniGlobe.top}px`,
      '--mini-globe-right': `${miniGlobe.right}px`,
      '--mini-globe-scale': String(miniGlobe.scale),
      '--scale-bar-top': `${scaleBarTop}px`,
      '--area-strip-top': `${stripTop}px`,
    });
  });

  it('sets no variables before the viewport is known', () => {
    expect(getPhoneDetailOverlayStyle(null)).toEqual({});
  });
});

describe('getDetailSheetOpenTop', () => {
  it('opens the detail sheet at 150 on the 390 × 844 board', () => {
    expect(getDetailSheetOpenTop(getPhoneLayout(390, 844))).toBe(150);
  });

  it('keeps the open sheet 22 px below the action row on short screens', () => {
    expect(getDetailSheetOpenTop(getPhoneLayout(320, 640))).toBe(150);
  });

  it('scales the open top on taller screens', () => {
    expect(getDetailSheetOpenTop(getPhoneLayout(430, 932))).toBeCloseTo((932 * 150) / 844, 6);
  });
});

describe('getPhoneStripLabelLeft', () => {
  it('puts the label 6 px right of the quake when it fits', () => {
    expect(getPhoneStripLabelLeft(0.2, 346, 150)).toBeCloseTo(0.2 * 346 + 6, 6);
  });

  it('puts the label 6 px left of the quake when it would pass the right end', () => {
    expect(getPhoneStripLabelLeft(0.62, 346, 160)).toBeCloseTo(0.62 * 346 - 6 - 160, 6);
  });

  it('keeps a label wider than either side inside the strip', () => {
    expect(getPhoneStripLabelLeft(0.45, 276, 200)).toBe(0);
    expect(getPhoneStripLabelLeft(0.98, 276, 200)).toBeCloseTo(0.98 * 276 - 6 - 200, 6);
  });

  it('starts a label wider than the strip at its left edge', () => {
    expect(getPhoneStripLabelLeft(0.98, 276, 280)).toBe(0);
  });
});

describe('getPhoneFeltLabelPlacement', () => {
  const centre = { x: 195, y: 290 };
  const full = { width: 120, height: 11 };
  const short = { width: 56, height: 11 };

  it('puts the full label 8 px above the ring when there is room under the action row', () => {
    expect(getPhoneFeltLabelPlacement(centre, 98, full, short)).toEqual({
      top: 290 - 98 - 8 - 11,
      isShort: false,
    });
  });

  it('moves the full label inside the ring, clear of the action row, when the ring reaches past it', () => {
    expect(getPhoneFeltLabelPlacement(centre, 192, full, short)).toEqual({
      top: 136,
      isShort: false,
    });
  });

  it('lowers the inside label until the ring line no longer crosses it', () => {
    const { top } = getPhoneFeltLabelPlacement(centre, 160, { width: 200, height: 11 }, short);
    const halfChord = Math.sqrt(160 ** 2 - (290 - top) ** 2);

    expect(top).toBeGreaterThan(136);
    expect(halfChord).toBeGreaterThanOrEqual(100 + 4 - 1e-9);
  });

  it('falls back to the short label inside a ring narrower than the full one', () => {
    const placement = getPhoneFeltLabelPlacement(
      { x: 160, y: 220 },
      75,
      { width: 200, height: 11 },
      short,
    );
    const halfChord = Math.sqrt(75 ** 2 - (220 - placement.top) ** 2);

    expect(placement.isShort).toBe(true);
    expect(placement.top).toBeGreaterThanOrEqual(136);
    expect(halfChord).toBeGreaterThanOrEqual(28 + 4 - 1e-9);
    expect(placement.top + 11).toBeLessThanOrEqual(220 - 16);
  });

  it('never goes above 136, 8 px under the action row', () => {
    expect(
      getPhoneFeltLabelPlacement({ x: 160, y: 160 }, 30, { width: 200, height: 11 }, short).top,
    ).toBe(136);
  });
});

describe('getPhoneTickLabelsShown', () => {
  const days = [0.07, 0.21, 0.36, 0.5, 0.64, 0.79, 0.93];

  it('shows every day label when they fit with an 8 px gap', () => {
    expect(getPhoneTickLabelsShown(days, 346, Array(7).fill(36))).toEqual(Array(7).fill(true));
  });

  it('shows every other day label when neighbours would touch', () => {
    expect(getPhoneTickLabelsShown(days, 276, Array(7).fill(40))).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
  });

  it('drops a label that would reach more than 6 px past the strip ends', () => {
    expect(getPhoneTickLabelsShown([0.01, 0.5, 0.99], 276, [40, 40, 40])).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('starts every other label from the second day when the first would be clipped', () => {
    const clippedEnds = [0.01, 0.17, 0.33, 0.49, 0.65, 0.81, 0.97];
    expect(getPhoneTickLabelsShown(clippedEnds, 276, Array(7).fill(40))).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
  });
});

describe('getMapSheetTopStyle', () => {
  const layout = getPhoneLayout(390, 844);

  it('lifts the map controls above the collapsed detail sheet when an Earthquake is open', () => {
    expect(getMapSheetTopStyle(layout, true)).toEqual({ '--map-sheet-top': '566px' });
  });

  it('lifts them above the collapsed home sheet otherwise', () => {
    expect(getMapSheetTopStyle(layout, false)).toEqual({ '--map-sheet-top': '548px' });
  });

  it('sets nothing before the viewport is known', () => {
    expect(getMapSheetTopStyle(null, true)).toEqual({});
  });
});
