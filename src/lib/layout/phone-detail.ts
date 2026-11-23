import type { CSSProperties } from 'react';

import { MINI_GLOBE_LOOK } from '@/lib/globe/map-locator';

import { PHONE_ACTION_ROW_BOTTOM, type PhoneLayout } from './phone';

const OPEN_SHEET_BELOW_ROW_PX = 22;
const FELT_LABEL = { gapPx: 8, chordPaddingPx: 4, markerClearPx: 16 } as const;
const FELT_LABEL_MIN_TOP_PX = PHONE_ACTION_ROW_BOTTOM + FELT_LABEL.gapPx;
const TICK_LABEL = { gapPx: 8, overhangPx: 6 } as const;
const MINI_GLOBE = { rightPx: 38, belowRowPx: 36, radiusPx: 22 } as const;
const STRIP = { heightPx: 111, sheetGapPx: 6, scaleBarGapPx: 10, labelGapPx: 6 } as const;
const MINI_GLOBE_HALF_BOX_PX = MINI_GLOBE_LOOK.radiusPx + MINI_GLOBE_LOOK.marginPx;

export type PhoneDetailOverlay = {
  miniGlobe: { top: number; right: number; scale: number };
  scaleBarTop: number;
  stripTop: number;
};

export function getPhoneDetailOverlay({ k, detailSheetTop }: PhoneLayout): PhoneDetailOverlay {
  const stripTop = detailSheetTop - STRIP.sheetGapPx - STRIP.heightPx;
  return {
    miniGlobe: {
      top: PHONE_ACTION_ROW_BOTTOM + MINI_GLOBE.belowRowPx * k - MINI_GLOBE_HALF_BOX_PX,
      right: MINI_GLOBE.rightPx * k - MINI_GLOBE_HALF_BOX_PX,
      scale: (MINI_GLOBE.radiusPx * k) / MINI_GLOBE_LOOK.radiusPx,
    },
    scaleBarTop: stripTop - STRIP.scaleBarGapPx,
    stripTop,
  };
}

export function getDetailSheetOpenTop({ detailSheetOpenTop }: PhoneLayout): number {
  return Math.max(detailSheetOpenTop, PHONE_ACTION_ROW_BOTTOM + OPEN_SHEET_BELOW_ROW_PX);
}

export function getPhoneDetailOverlayStyle(layout: PhoneLayout | null): CSSProperties {
  if (!layout) return {};
  const { miniGlobe, scaleBarTop, stripTop } = getPhoneDetailOverlay(layout);
  return {
    '--mini-globe-top': `${miniGlobe.top}px`,
    '--mini-globe-right': `${miniGlobe.right}px`,
    '--mini-globe-scale': String(miniGlobe.scale),
    '--scale-bar-top': `${scaleBarTop}px`,
    '--area-strip-top': `${stripTop}px`,
  } as CSSProperties;
}

export function getPhoneStripLabelLeft(x: number, stripWidth: number, labelWidth: number): number {
  const quakeX = x * stripWidth;
  const after = quakeX + STRIP.labelGapPx;
  const left = after + labelWidth <= stripWidth ? after : quakeX - STRIP.labelGapPx - labelWidth;
  return Math.max(0, Math.min(left, stripWidth - labelWidth));
}

type ScreenPoint = { x: number; y: number };
type LabelSize = { width: number; height: number };

function getInsideFeltLabelTop(centre: ScreenPoint, radius: number, label: LabelSize): number {
  const halfWidth = label.width / 2 + FELT_LABEL.chordPaddingPx;
  if (radius <= halfWidth) return Number.POSITIVE_INFINITY;
  const chordTop = centre.y - Math.sqrt(radius ** 2 - halfWidth ** 2);
  return Math.max(FELT_LABEL_MIN_TOP_PX, centre.y - radius + FELT_LABEL.gapPx, chordTop);
}

function getAboveFeltLabelTop(centre: ScreenPoint, radius: number, label: LabelSize): number {
  return centre.y - radius - FELT_LABEL.gapPx - label.height;
}

function isClearOfMarker(top: number, centre: ScreenPoint, label: LabelSize): boolean {
  return top + label.height <= centre.y - FELT_LABEL.markerClearPx;
}

export function getPhoneFeltLabelPlacement(
  centre: ScreenPoint,
  radius: number,
  full: LabelSize,
  short: LabelSize,
): { top: number; isShort: boolean } {
  const above = getAboveFeltLabelTop(centre, radius, full);
  if (above >= FELT_LABEL_MIN_TOP_PX) return { top: above, isShort: false };
  const inside = getInsideFeltLabelTop(centre, radius, full);
  if (isClearOfMarker(inside, centre, full)) return { top: inside, isShort: false };
  const shortInside = getInsideFeltLabelTop(centre, radius, short);
  if (isClearOfMarker(shortInside, centre, short)) return { top: shortInside, isShort: true };
  return { top: FELT_LABEL_MIN_TOP_PX, isShort: true };
}

function getTickLabelStep(xs: number[], stripWidth: number, widest: number): number {
  for (let step = 1; step < xs.length; step++) {
    const isClear = xs.every(
      (x, index) =>
        index + step >= xs.length ||
        (xs[index + step] - x) * stripWidth >= widest + TICK_LABEL.gapPx,
    );
    if (isClear) return step;
  }
  return Math.max(1, xs.length);
}

function getTickLabelsInside(xs: number[], stripWidth: number, widths: number[]): boolean[] {
  return xs.map((x, index) => {
    const centre = x * stripWidth;
    const half = widths[index] / 2;
    return (
      centre - half >= -TICK_LABEL.overhangPx && centre + half <= stripWidth + TICK_LABEL.overhangPx
    );
  });
}

function getTickLabelsForPhase(inside: boolean[], step: number, phase: number): boolean[] {
  return inside.map((isInside, index) => index % step === phase && isInside);
}

function getShownCount(shown: boolean[]): number {
  return shown.filter(Boolean).length;
}

export function getPhoneTickLabelsShown(
  xs: number[],
  stripWidth: number,
  widths: number[],
): boolean[] {
  const step = getTickLabelStep(xs, stripWidth, Math.max(0, ...widths));
  const inside = getTickLabelsInside(xs, stripWidth, widths);
  let best = getTickLabelsForPhase(inside, step, 0);
  for (let phase = 1; phase < step; phase++) {
    const shown = getTickLabelsForPhase(inside, step, phase);
    if (getShownCount(shown) > getShownCount(best)) best = shown;
  }
  return best;
}

export function getMapSheetTopStyle(layout: PhoneLayout | null, isDetail: boolean): CSSProperties {
  if (!layout) return {};
  const top = isDetail ? layout.detailSheetTop : layout.homeSheetTop;
  return { '--map-sheet-top': `${top}px` } as CSSProperties;
}
