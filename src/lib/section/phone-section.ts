import type { CSSProperties } from 'react';

import { PHONE_ACTION_ROW_BOTTOM, type PhoneLayout } from '@/lib/layout/phone';

import { SECTION_FRAME } from './depth-scale';
import { SECTION_LOOK, type SectionModel, type SlabLabel } from './section-model';
import { SLICE_LOOK } from './slice-line';

const ACTION_ROW_GAP_PX = 8;

export const PHONE_SECTION = {
  top: PHONE_ACTION_ROW_BOTTOM + ACTION_ROW_GAP_PX,
  sheetGapPx: 8,
  padTopPx: 8,
  padBottomPx: 26,
  minSpan: 560,
  edgePx: 6,
  fontPx: 10,
  trackingPx: 1.5,
  lineStepPx: 14,
  markerGapPx: 18,
  capPx: 10,
  descentPx: 3,
  baselinePx: 3.5,
} as const;

const SLAB_LABEL_STEPS = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5] as const;

export type SectionBox = { x: number; y: number; width: number; height: number };
export type SectionContent = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centre: number;
};
export type PhoneSectionView = SectionBox & { unit: number };
export type PlacedLabel = { x: number; y: number; anchor: 'start' | 'end'; box: SectionBox };

export function getPhoneSectionBand({ detailMapBottom }: PhoneLayout): {
  top: number;
  height: number;
} {
  return {
    top: PHONE_SECTION.top,
    height: detailMapBottom - PHONE_SECTION.sheetGapPx - PHONE_SECTION.top,
  };
}

export function getPhoneSectionBandStyle(layout: PhoneLayout | null): CSSProperties {
  if (!layout) return {};
  const { top, height } = getPhoneSectionBand(layout);
  return { '--section-top': `${top}px`, '--section-height': `${height}px` } as CSSProperties;
}

export function getSectionContentTop(lines: readonly string[]): number {
  let top = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    for (const point of line.split(' ')) {
      const y = Number(point.slice(point.indexOf(',') + 1));
      if (y < top) top = y;
    }
  }
  return top;
}

function getClamped(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getViewX(width: number, content: SectionContent): number {
  const contentWidth = content.right - content.left;
  if (width >= contentWidth) return content.left - (width - contentWidth) / 2;
  return getClamped(content.centre - width / 2, content.left, content.right - width);
}

export function getPhoneSectionView(
  box: { width: number; height: number },
  content: SectionContent,
): PhoneSectionView {
  const { padTopPx, padBottomPx, minSpan } = PHONE_SECTION;
  const heightScale = (box.height - padTopPx - padBottomPx) / (content.bottom - content.top);
  const scale = Math.min(heightScale, box.width / minSpan);
  const unit = 1 / scale;
  const width = box.width * unit;
  const height = box.height * unit;
  const span = content.bottom - content.top + (padTopPx + padBottomPx) * unit;
  return {
    x: getViewX(width, content),
    y: content.top - padTopPx * unit - (height - span) / 2,
    width,
    height,
    unit,
  };
}

function getLineBox(left: number, baseline: number, width: number, unit: number): SectionBox {
  const { capPx, descentPx } = PHONE_SECTION;
  return { x: left, y: baseline - capPx * unit, width, height: (capPx + descentPx) * unit };
}

export function getPhoneHypocentreLabel(
  view: PhoneSectionView,
  hypocentre: { x: number; y: number },
  width: number,
): PlacedLabel {
  const gap = PHONE_SECTION.markerGapPx * view.unit;
  const y = hypocentre.y + PHONE_SECTION.baselinePx * view.unit;
  const right = view.x + view.width - PHONE_SECTION.edgePx * view.unit;
  const after = hypocentre.x + gap;
  if (after + width <= right) {
    return { x: after, y, anchor: 'start', box: getLineBox(after, y, width, view.unit) };
  }
  const before = hypocentre.x - gap;
  return { x: before, y, anchor: 'end', box: getLineBox(before - width, y, width, view.unit) };
}

function isOverlapping(a: SectionBox, b: SectionBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function getSlabBox(left: number, y: number, width: number, unit: number): SectionBox {
  const { capPx, descentPx, lineStepPx } = PHONE_SECTION;
  return {
    x: left,
    y: y - capPx * unit,
    width,
    height: (capPx + lineStepPx + descentPx) * unit,
  };
}

export function getPhoneSlabLabel(
  view: PhoneSectionView,
  label: SlabLabel,
  width: number,
  obstacles: readonly SectionBox[],
): PlacedLabel {
  const { unit } = view;
  const edge = PHONE_SECTION.edgePx * unit;
  const getLeft = (left: number) =>
    getClamped(left, view.x + edge, view.x + view.width - edge - width);
  const preferred = label.anchor === 'end' ? label.x - width : label.x;
  const lefts = [preferred, ...obstacles.map((obstacle) => obstacle.x + obstacle.width + edge)].map(
    getLeft,
  );
  const top = view.y + PHONE_SECTION.capPx * unit;
  const bottom = view.y + view.height - (PHONE_SECTION.lineStepPx + PHONE_SECTION.descentPx) * unit;
  const ys = SLAB_LABEL_STEPS.map((step) =>
    getClamped(label.y + step * PHONE_SECTION.lineStepPx * unit, top, bottom),
  );
  for (const left of lefts) {
    for (const y of ys) {
      const box = getSlabBox(left, y, width, unit);
      if (obstacles.every((obstacle) => !isOverlapping(box, obstacle))) {
        return { x: left, y, anchor: 'start', box };
      }
    }
  }
  return { x: lefts[0], y: ys[0], anchor: 'start', box: getSlabBox(lefts[0], ys[0], width, unit) };
}

export function getSectionContent(model: SectionModel): SectionContent {
  return {
    left: SECTION_FRAME.left,
    right: SECTION_FRAME.right + SECTION_LOOK.backStepX * SLICE_LOOK.backLines,
    top: getSectionContentTop([
      ...model.backLines.map(({ line }) => line),
      model.front.surface,
      model.east.surface,
    ]),
    bottom: model.scale.bottomY,
    centre: model.hypocentre.x,
  };
}
