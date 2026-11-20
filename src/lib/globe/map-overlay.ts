import { PHONE_MAX_WIDTH, getPhoneLayout } from '@/lib/layout/phone';

import { getGlobeFrame } from './frame';

export const REPLAY_RING_LOOK = {
  durationMs: 3200,
  count: 3,
  stagger: 0.12,
  span: 0.76,
  startPx: 8,
  alpha: 0.8,
  strokePx: 1.5,
} as const;

export const LOOP_RING_LOOK = {
  delayMs: 450,
  cycleMs: 7000,
  activeMs: 5200,
  alphaScale: 0.5,
  strokePx: 1,
} as const;

export const RING_LABEL_LOOK = {
  felt: { bearingDeg: 38.4, offsetPx: 12.5 },
  area: { bearingDeg: -52.1, offsetPx: -10.6 },
} as const;

const BOARD = { width: 1440, height: 900, radiusPx: 330 } as const;
const DETAIL_FOCUS_Y = 392;
// The earthquake panel's right edge: md:left-14 + md:w-105 in earthquake-panel.tsx.
const DETAIL_PANEL_RIGHT_PX = 476;
const FADE_SOLID_PX = 286;
const FADE_END_PX = 520;

export type ReplayRing = { radiusPx: number; alpha: number };
export type MapPadding = { top: number; bottom: number; left: number; right: number };
type ScreenPoint = { x: number; y: number };

function getRoundedPx(value: number): number {
  return Math.round(value * 10) / 10;
}

function getWaveRings(progress: number, endPx: number, alphaScale: number): ReplayRing[] {
  const { count, stagger, span, startPx, alpha } = REPLAY_RING_LOOK;
  const rings: ReplayRing[] = [];
  for (let index = 0; index < count; index++) {
    const f = Math.min(1, Math.max(0, (progress - index * stagger) / span));
    if (f <= 0 || f >= 1) continue;
    const eased = 1 - (1 - f) ** 2;
    rings.push({
      radiusPx: startPx + eased * (endPx - startPx),
      alpha: (1 - f) * alpha * alphaScale,
    });
  }
  return rings;
}

export function getReplayRings(elapsedMs: number, endPx: number): ReplayRing[] {
  return getWaveRings(elapsedMs / REPLAY_RING_LOOK.durationMs, endPx, 1);
}

export function getLoopRings(sinceSelectMs: number, endPx: number): ReplayRing[] {
  const { delayMs, cycleMs, activeMs, alphaScale } = LOOP_RING_LOOK;
  const elapsed = sinceSelectMs - delayMs;
  if (elapsed < 0) return [];
  const progress = (elapsed % cycleMs) / activeMs;
  if (progress >= 1) return [];
  return getWaveRings(progress, endPx, alphaScale);
}

function getEdgePadding(focus: number, size: number): [number, number] {
  const offset = Math.round(2 * focus - size);
  return [Math.max(0, offset), Math.max(0, -offset)];
}

export function getDetailPadding(width: number, height: number): MapPadding {
  if (width < PHONE_MAX_WIDTH) {
    const [top, bottom] = getEdgePadding(getPhoneLayout(width, height).detailFocusY, height);
    return { top, bottom, left: 0, right: 0 };
  }
  const [top, bottom] = getEdgePadding((height * DETAIL_FOCUS_Y) / BOARD.height, height);
  return { top, bottom, left: DETAIL_PANEL_RIGHT_PX, right: 0 };
}

function getFadeScale(width: number, height: number): number {
  if (width >= PHONE_MAX_WIDTH) return getGlobeFrame(width, height).radius / BOARD.radiusPx;
  const { detailSheetTop, detailFocusY } = getPhoneLayout(width, height);
  return (detailSheetTop - detailFocusY) / (BOARD.height - DETAIL_FOCUS_Y);
}

export function getMapFadeMask(width: number, height: number, centre: ScreenPoint): string {
  const scale = getFadeScale(width, height);
  const solid = getRoundedPx(FADE_SOLID_PX * scale);
  const end = getRoundedPx(FADE_END_PX * scale);
  return `radial-gradient(circle at ${getRoundedPx(centre.x)}px ${getRoundedPx(centre.y)}px, #000 ${solid}px, transparent ${end}px)`;
}
