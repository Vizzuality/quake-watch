import { describe, expect, it } from 'vitest';

import { getPhoneLayout } from '@/lib/layout/phone';

import { SECTION_FRAME } from './depth-scale';
import {
  PHONE_SECTION,
  type SectionBox,
  type SectionContent,
  getPhoneHypocentreLabel,
  getPhoneSectionBand,
  getPhoneSectionBandStyle,
  getPhoneSectionView,
  getPhoneSlabLabel,
  getSectionContentTop,
} from './phone-section';

const CONTENT: SectionContent = {
  left: 585,
  right: 1387,
  top: 250,
  bottom: 680,
  centre: SECTION_FRAME.centre,
};

function getRight(box: SectionBox): number {
  return box.x + box.width;
}

function getBottom(box: SectionBox): number {
  return box.y + box.height;
}

function isOverlapping(a: SectionBox, b: SectionBox): boolean {
  return a.x < getRight(b) && b.x < getRight(a) && a.y < getBottom(b) && b.y < getBottom(a);
}

describe('getPhoneSectionBand', () => {
  it.each([
    [390, 844, 422],
    [360, 740, 318],
    [320, 640, 218],
  ])(
    'runs from 8 px under the action row to 8 px above the collapsed sheet at %ix%i',
    (width, height, bandHeight) => {
      expect(getPhoneSectionBand(getPhoneLayout(width, height))).toEqual({
        top: 136,
        height: bandHeight,
      });
    },
  );

  it('exposes the band as CSS variables, and nothing before the viewport is known', () => {
    expect(getPhoneSectionBandStyle(getPhoneLayout(390, 844))).toEqual({
      '--section-top': '136px',
      '--section-height': '422px',
    });
    expect(getPhoneSectionBandStyle(null)).toEqual({});
  });
});

describe('getSectionContentTop', () => {
  it('returns the highest point of every drawn line', () => {
    expect(getSectionContentTop(['600,330 700,310.5', '610,300 620,280.2'])).toBe(280.2);
  });
});

describe('getPhoneSectionView', () => {
  it('keeps the box aspect so nothing is stretched', () => {
    const view = getPhoneSectionView({ width: 358, height: 380 }, CONTENT);
    expect(view.width / view.height).toBeCloseTo(358 / 380, 6);
    expect(view.unit).toBeCloseTo(view.width / 358, 6);
  });

  it('shows the whole depth range with room for the W and E labels', () => {
    for (const box of [
      { width: 358, height: 380 },
      { width: 328, height: 270 },
      { width: 288, height: 170 },
    ]) {
      const view = getPhoneSectionView(box, CONTENT);
      expect(view.y).toBeLessThanOrEqual(CONTENT.top - PHONE_SECTION.padTopPx * view.unit + 1e-6);
      expect(getBottom(view)).toBeGreaterThanOrEqual(
        CONTENT.bottom + PHONE_SECTION.padBottomPx * view.unit - 1e-6,
      );
    }
  });

  it('zooms in on the earthquake on a tall box, but never closer than the minimum span', () => {
    const view = getPhoneSectionView({ width: 358, height: 380 }, CONTENT);
    expect(view.width).toBeCloseTo(PHONE_SECTION.minSpan, 6);
    expect(view.x + view.width / 2).toBeCloseTo(CONTENT.centre, 6);
  });

  it('shows the whole width, centred, when the box is short', () => {
    const view = getPhoneSectionView({ width: 288, height: 170 }, CONTENT);
    expect(view.width).toBeGreaterThan(CONTENT.right - CONTENT.left);
    expect(view.x + view.width / 2).toBeCloseTo((CONTENT.left + CONTENT.right) / 2, 6);
  });

  it('keeps a zoomed view inside the drawing when the earthquake sits near one end', () => {
    const view = getPhoneSectionView(
      { width: 358, height: 380 },
      { ...CONTENT, centre: CONTENT.right - 50 },
    );
    expect(getRight(view)).toBeCloseTo(CONTENT.right, 6);
  });
});

describe('getPhoneHypocentreLabel', () => {
  const view = { x: 670, y: 220, width: 560, height: 594, unit: 1.5 };

  it('puts the label to the right of the marker when it fits', () => {
    const label = getPhoneHypocentreLabel(view, { x: 950, y: 500 }, 150);
    expect(label.x).toBeCloseTo(950 + 18 * 1.5, 6);
    expect(label.anchor).toBe('start');
    expect(label.box.x).toBeCloseTo(label.x, 6);
  });

  it('moves it to the left of the marker when it would pass the right edge', () => {
    const label = getPhoneHypocentreLabel(view, { x: 1150, y: 500 }, 150);
    expect(label.anchor).toBe('end');
    expect(getRight(label.box)).toBeCloseTo(1150 - 18 * 1.5, 6);
  });
});

describe('getPhoneSlabLabel', () => {
  const view = { x: 670, y: 220, width: 560, height: 594, unit: 1.5 };

  it('keeps the requested anchor point when the label fits and nothing is in the way', () => {
    const label = getPhoneSlabLabel(view, { x: 1100, y: 400, anchor: 'end' }, 200, []);
    expect(label.x).toBeCloseTo(900, 6);
    expect(label.y).toBe(400);
  });

  it('pulls a label that would pass the left edge back inside the view', () => {
    const label = getPhoneSlabLabel(view, { x: 700, y: 400, anchor: 'end' }, 200, []);
    expect(label.x).toBeCloseTo(view.x + PHONE_SECTION.edgePx * view.unit, 6);
  });

  it('pulls a label that would pass the right edge back inside the view', () => {
    const label = getPhoneSlabLabel(view, { x: 1150, y: 400, anchor: 'start' }, 200, []);
    expect(label.x + 200).toBeCloseTo(getRight(view) - PHONE_SECTION.edgePx * view.unit, 6);
  });

  it('steps away from a label it would cover', () => {
    const obstacle = { x: 850, y: 380, width: 200, height: 30 };
    const label = getPhoneSlabLabel(view, { x: 1100, y: 400, anchor: 'end' }, 200, [obstacle]);
    expect(isOverlapping(label.box, obstacle)).toBe(false);
    expect(label.box.y).toBeGreaterThanOrEqual(view.y);
    expect(getBottom(label.box)).toBeLessThanOrEqual(getBottom(view));
  });

  it('moves beside a column of labels that blocks every height at the anchor', () => {
    const column = { x: 680, y: view.y, width: 60, height: view.height };
    const label = getPhoneSlabLabel(view, { x: 700, y: 400, anchor: 'end' }, 200, [column]);
    expect(isOverlapping(label.box, column)).toBe(false);
    expect(label.x).toBeCloseTo(740 + PHONE_SECTION.edgePx * view.unit, 6);
  });
});
