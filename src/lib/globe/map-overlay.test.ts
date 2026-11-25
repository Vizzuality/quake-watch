import { describe, expect, it } from 'vitest';

import {
  LOOP_RING_LOOK,
  REPLAY_RING_LOOK,
  getAreaFrame,
  getDetailPadding,
  getLoopRings,
  getMapFadeMask,
  getReplayRings,
} from './map-overlay';

describe('getReplayRings', () => {
  it('draws nothing before the first ring starts or after the last one ends', () => {
    expect(getReplayRings(0, 210)).toEqual([]);
    expect(getReplayRings(REPLAY_RING_LOOK.durationMs, 210)).toEqual([]);
  });

  it('staggers three rings that ease out from 8 px to the felt reach and fade as they grow', () => {
    const rings = getReplayRings(REPLAY_RING_LOOK.durationMs / 2, 208);

    expect(rings).toHaveLength(3);
    const progress = [0.5 / 0.76, 0.38 / 0.76, 0.26 / 0.76];
    rings.forEach((ring, index) => {
      const f = progress[index];
      expect(ring.radiusPx).toBeCloseTo(8 + (1 - (1 - f) ** 2) * 200, 6);
      expect(ring.alpha).toBeCloseTo((1 - f) * 0.8, 6);
    });
  });

  it('keeps only the rings still on their way out', () => {
    expect(getReplayRings(REPLAY_RING_LOOK.durationMs * 0.8, 210)).toHaveLength(2);
  });
});

describe('getLoopRings', () => {
  it('waits 450 ms after the selection before the first wave', () => {
    expect(getLoopRings(LOOP_RING_LOOK.delayMs - 1, 210)).toEqual([]);
  });

  it('runs each wave for 5.2 s and rests until the 7 s cycle ends', () => {
    const { delayMs, activeMs, cycleMs } = LOOP_RING_LOOK;

    expect(getLoopRings(delayMs + activeMs / 2, 210)).toHaveLength(3);
    expect(getLoopRings(delayMs + activeMs + 100, 210)).toEqual([]);
    expect(getLoopRings(delayMs + cycleMs + activeMs / 2, 210)).toEqual(
      getLoopRings(delayMs + activeMs / 2, 210),
    );
  });

  it('draws the looping wave fainter than the Replay rings', () => {
    const [ring] = getLoopRings(LOOP_RING_LOOK.delayMs + LOOP_RING_LOOK.activeMs / 2, 208);
    const [replay] = getReplayRings(REPLAY_RING_LOOK.durationMs / 2, 208);

    expect(ring.radiusPx).toBeCloseTo(replay.radiusPx, 6);
    expect(ring.alpha).toBeCloseTo(replay.alpha / 2, 6);
  });
});

describe('getAreaFrame', () => {
  it('fits the area inside the globe disc, 48 px in, on the 1440 × 900 board', () => {
    expect(getAreaFrame(1440, 900)).toEqual({
      padding: { top: 180, bottom: 156, left: 438, right: 438 },
      radiusPx: 282,
    });
  });

  it('fits the area between the header and the home sheet, full width, on the 390 × 844 phone board', () => {
    expect(getAreaFrame(390, 844)).toEqual({
      padding: { top: 160, bottom: 344, left: 48, right: 48 },
      radiusPx: 147,
    });
  });

  it('fits the area left of the side sheet on short landscape screens', () => {
    expect(getAreaFrame(844, 390)).toEqual({
      padding: { top: 100, bottom: 48, left: 48, right: 368 },
      radiusPx: 121,
    });
  });
});

describe('getDetailPadding', () => {
  it('puts the camera centre in the middle of the space right of the panel, at y 392 on the 1440 × 900 board', () => {
    expect(getDetailPadding(1440, 900)).toEqual({ top: 0, bottom: 116, left: 476, right: 0 });
  });

  it('keeps the earthquake in the middle of the space right of the panel on wider screens', () => {
    expect(getDetailPadding(1920, 1080)).toEqual({
      top: 0,
      bottom: Math.round(1080 - (2 * 1080 * 392) / 900),
      left: 476,
      right: 0,
    });
  });

  it('puts the camera centre at y 290 of the 390 × 844 phone board, above the detail sheet', () => {
    expect(getDetailPadding(390, 844)).toEqual({ top: 0, bottom: 264, left: 0, right: 0 });
  });

  it('puts the camera centre left of the side sheet and below the action row on short landscape screens', () => {
    expect(getDetailPadding(844, 390)).toEqual({ top: 128, bottom: 0, left: 0, right: 320 });
  });

  it('scales the phone camera centre with the screen height', () => {
    expect(getDetailPadding(320, 640)).toEqual({
      top: 0,
      bottom: Math.round(640 - (2 * 640 * 290) / 844),
      left: 0,
      right: 0,
    });
  });
});

describe('getMapFadeMask', () => {
  it('fades the map from 286 to 520 px around the given centre on the 1440 × 900 board', () => {
    expect(getMapFadeMask(1440, 900, { x: 1000, y: 392 })).toBe(
      'radial-gradient(circle at 1000px 392px, #000 286px, transparent 520px)',
    );
  });

  it('ends the phone fade at the detail sheet, as the desktop one ends at the bottom edge', () => {
    expect(getMapFadeMask(390, 844, { x: 195, y: 290 })).toBe(
      'radial-gradient(circle at 195px 290px, #000 155.4px, transparent 282.5px)',
    );
  });

  it('scales the fade with the globe frame', () => {
    expect(getMapFadeMask(1440, 600, { x: 360, y: 231 })).toBe(
      'radial-gradient(circle at 360px 231px, #000 190.7px, transparent 346.7px)',
    );
  });
});
