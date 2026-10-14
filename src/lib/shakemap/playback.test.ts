import { describe, expect, it } from 'vitest';

import { getAdvancedProgress, getInitialProgress, getPlayStartProgress } from './playback';
import { SHAKEMAP_PLAY_DURATION_MS } from './reveal';

describe('getAdvancedProgress', () => {
  it('covers the whole Felt reach in the play duration', () => {
    expect(getAdvancedProgress(0, SHAKEMAP_PLAY_DURATION_MS / 4)).toBeCloseTo(0.25);
    expect(getAdvancedProgress(0.5, SHAKEMAP_PLAY_DURATION_MS / 2)).toBe(1);
  });

  it('stops at the end and never runs backwards', () => {
    expect(getAdvancedProgress(0.9, SHAKEMAP_PLAY_DURATION_MS)).toBe(1);
    expect(getAdvancedProgress(0.4, -100)).toBe(0.4);
  });
});

describe('getPlayStartProgress', () => {
  it('restarts from the Epicenter once the wave has reached its end', () => {
    expect(getPlayStartProgress(1)).toBe(0);
    expect(getPlayStartProgress(0.3)).toBe(0.3);
  });
});

describe('getInitialProgress', () => {
  it('starts at the final state when motion is reduced', () => {
    expect(getInitialProgress(true)).toBe(1);
    expect(getInitialProgress(false)).toBe(0);
  });
});
