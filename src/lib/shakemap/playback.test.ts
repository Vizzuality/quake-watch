import { describe, expect, it } from 'vitest';

import {
  getAdvancedSeconds,
  getInitialSeconds,
  getPlayStartSeconds,
  getRunDurationSeconds,
} from './playback';
import { WAVE_SCREEN_MS } from './wave';

describe('getAdvancedSeconds', () => {
  it('covers the whole run in the screen duration', () => {
    expect(getAdvancedSeconds(0, WAVE_SCREEN_MS / 4, 120)).toBeCloseTo(30);
    expect(getAdvancedSeconds(60, WAVE_SCREEN_MS / 2, 120)).toBe(120);
  });

  it('stops at the end and never runs backwards', () => {
    expect(getAdvancedSeconds(100, WAVE_SCREEN_MS, 120)).toBe(120);
    expect(getAdvancedSeconds(40, -100, 120)).toBe(40);
  });
});

describe('getPlayStartSeconds', () => {
  it('restarts from the rupture start once the run has ended', () => {
    expect(getPlayStartSeconds(120, 120)).toBe(0);
    expect(getPlayStartSeconds(30, 120)).toBe(30);
  });
});

describe('getInitialSeconds', () => {
  it('starts at the final state when motion is reduced', () => {
    expect(getInitialSeconds(true, 120)).toBe(120);
    expect(getInitialSeconds(false, 120)).toBe(0);
  });
});

describe('getRunDurationSeconds', () => {
  it('rounds up to whole seconds and never collapses to zero', () => {
    expect(getRunDurationSeconds(103.2)).toBe(104);
    expect(getRunDurationSeconds(0)).toBe(1);
  });
});
