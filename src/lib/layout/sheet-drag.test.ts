import { describe, expect, it } from 'vitest';

import { isSheetDragToggle } from './sheet-drag';

describe('isSheetDragToggle', () => {
  it.each([
    ['opens a collapsed sheet dragged up past 40 px', -41, 1000, false],
    ['closes an open sheet dragged down past 40 px', 41, 1000, true],
    ['opens a collapsed sheet flicked up faster than 0.5 px/ms', -20, 30, false],
  ])('%s', (_, deltaY, durationMs, isOpen) => {
    expect(isSheetDragToggle(deltaY, durationMs, isOpen)).toBe(true);
  });

  it.each([
    ['a slow short drag', -30, 200, false],
    ['a drag of exactly 40 px at 0.5 px/ms', -40, 80, false],
    ['a drag away from the other position', 80, 100, false],
    ['an open sheet dragged further up', -80, 100, true],
  ])('snaps back after %s', (_, deltaY, durationMs, isOpen) => {
    expect(isSheetDragToggle(deltaY, durationMs, isOpen)).toBe(false);
  });
});
