import { describe, expect, it } from 'vitest';

import { EARTHQUAKE_SEARCH_DEFAULTS } from './search-schema';
import {
  getBarClassName,
  getBarHeight,
  getBarPath,
  getBinIndexAtFraction,
  getEffectiveWindow,
  getIsSpaceToggleTarget,
  getKeyedWindowEnd,
  getQuantisedTime,
  getSearchKey,
  getShouldRefreshValueText,
  getSliderStepMs,
  getSteppedWindowEnd,
  getTimeAtFraction,
  getWindowEnd,
} from './timeline-view';

const loaded = { start: 1000, end: 2000 };

describe('getWindowEnd', () => {
  const key = 'k';
  it('is null without data', () => {
    expect(getWindowEnd({ loaded: null, t: undefined, override: null, key })).toBeNull();
  });
  it('follows the loaded end without t or override', () => {
    expect(getWindowEnd({ loaded, t: undefined, override: null, key })).toBe(2000);
  });
  it('parses and clamps t', () => {
    expect(getWindowEnd({ loaded, t: new Date(1500).toISOString(), override: null, key })).toBe(
      1500,
    );
    expect(getWindowEnd({ loaded, t: new Date(10).toISOString(), override: null, key })).toBe(1000);
  });
  it('prefers an override for the same search', () => {
    expect(getWindowEnd({ loaded, t: undefined, override: { end: 1200, key }, key })).toBe(1200);
  });
  it('ignores an override from another search', () => {
    expect(getWindowEnd({ loaded, t: undefined, override: { end: 1200, key: 'x' }, key })).toBe(
      2000,
    );
  });
});

describe('search helpers', () => {
  it('keys ignore t, window, sort and page', () => {
    const base = getSearchKey(EARTHQUAKE_SEARCH_DEFAULTS);
    const moved = {
      ...EARTHQUAKE_SEARCH_DEFAULTS,
      t: '2026-01-01T00:00:00Z',
      window: '7d',
      page: 3,
    };
    expect(getSearchKey(moved as typeof EARTHQUAKE_SEARCH_DEFAULTS)).toBe(base);
    expect(getSearchKey({ ...EARTHQUAKE_SEARCH_DEFAULTS, period: '7d' })).not.toBe(base);
  });
  it('forces the 24h window for a 24h period', () => {
    expect(getEffectiveWindow('24h', '7d')).toBe('24h');
    expect(getEffectiveWindow('30d', '7d')).toBe('7d');
  });
  it('steps per window', () => {
    expect(getSliderStepMs('24h')).toBe(60_000);
    expect(getSliderStepMs('7d')).toBe(600_000);
  });
});

describe('histogram geometry', () => {
  it('maps fractions to times and bins', () => {
    expect(getTimeAtFraction(loaded, 0.5)).toBe(1500);
    expect(getTimeAtFraction(loaded, 2)).toBe(2000);
    expect(getTimeAtFraction(loaded, -1)).toBe(1000);
    expect(getBinIndexAtFraction(4, 0.6)).toBe(2);
    expect(getBinIndexAtFraction(4, 1)).toBe(3);
    expect(getBinIndexAtFraction(4, -0.2)).toBe(0);
  });
  it('steps by one bin and clamps', () => {
    const bins = [
      { start: 1000, end: 1400, count: 0 },
      { start: 1400, end: 2000, count: 0 },
    ];
    expect(getSteppedWindowEnd({ bins, loaded, current: 1100, direction: 1 })).toBe(1500);
    expect(getSteppedWindowEnd({ bins, loaded, current: 1100, direction: -1 })).toBe(1000);
    expect(getSteppedWindowEnd({ bins, loaded, current: 2000, direction: 1 })).toBe(2000);
    expect(getSteppedWindowEnd({ bins: [], loaded, current: 1500, direction: -1 })).toBe(1000);
  });
  it('draws a bar with rounded top and square base', () => {
    expect(getBarPath({ x: 0, width: 10, height: 20, baseline: 30, radius: 4 })).toBe(
      'M0 30V14Q0 10 4 10H6Q10 10 10 14V30Z',
    );
    expect(getBarPath({ x: 0, width: 10, height: 2, baseline: 30, radius: 4 })).toContain('V30Z');
  });
});

describe('getIsSpaceToggleTarget', () => {
  it('rejects text inputs, selects and buttons', () => {
    expect(getIsSpaceToggleTarget({ tagName: 'INPUT', type: 'text' })).toBe(false);
    expect(getIsSpaceToggleTarget({ tagName: 'SELECT' })).toBe(false);
    expect(getIsSpaceToggleTarget({ tagName: 'BUTTON' })).toBe(false);
  });
  it('accepts range inputs and other elements', () => {
    expect(getIsSpaceToggleTarget({ tagName: 'INPUT', type: 'range' })).toBe(true);
    expect(getIsSpaceToggleTarget({ tagName: 'svg' })).toBe(true);
  });
});

describe('getKeyedWindowEnd', () => {
  const DAY = 86_400_000;
  const week = { start: 0, end: 30 * DAY };
  const bins = [
    { start: 0, end: 15 * DAY, count: 0 },
    { start: 15 * DAY, end: 30 * DAY, count: 0 },
  ];
  const base = { bins, loaded: week, current: 10 * DAY };
  it('jumps to the loaded edges on Home and End', () => {
    expect(getKeyedWindowEnd({ ...base, key: 'Home', unit: 'day' })).toBe(0);
    expect(getKeyedWindowEnd({ ...base, key: 'End', unit: 'day' })).toBe(30 * DAY);
  });
  it('pages one day for hourly bins and one week for daily bins', () => {
    expect(getKeyedWindowEnd({ ...base, key: 'PageUp', unit: 'hour' })).toBe(11 * DAY);
    expect(getKeyedWindowEnd({ ...base, key: 'PageDown', unit: 'hour' })).toBe(9 * DAY);
    expect(getKeyedWindowEnd({ ...base, key: 'PageUp', unit: 'day' })).toBe(17 * DAY);
    expect(getKeyedWindowEnd({ ...base, key: 'PageDown', unit: 'day' })).toBe(3 * DAY);
    expect(getKeyedWindowEnd({ ...base, current: DAY, key: 'PageDown', unit: 'day' })).toBe(0);
  });
  it('steps one bin on arrows and ignores other keys', () => {
    expect(getKeyedWindowEnd({ ...base, key: 'ArrowRight', unit: 'day' })).toBe(25 * DAY);
    expect(getKeyedWindowEnd({ ...base, key: 'ArrowLeft', unit: 'day' })).toBe(0);
    expect(getKeyedWindowEnd({ ...base, key: 'a', unit: 'day' })).toBeNull();
  });
});

describe('getQuantisedTime', () => {
  it('rounds to the step and stays inside the range', () => {
    expect(getQuantisedTime(89_000, 60_000, { start: 0, end: 600_000 })).toBe(60_000);
    expect(getQuantisedTime(91_000, 60_000, { start: 0, end: 600_000 })).toBe(120_000);
    expect(getQuantisedTime(599_990, 60_000, { start: 0, end: 599_990 })).toBe(599_990);
    expect(getQuantisedTime(10, 60_000, { start: 5, end: 600_000 })).toBe(5);
  });
});

describe('bar helpers', () => {
  it('hides empty bins and keeps small bins visible', () => {
    expect(getBarHeight(0, 10, 56)).toBe(0);
    expect(getBarHeight(10, 10, 56)).toBe(52);
    expect(getBarHeight(1, 1000, 56)).toBe(2);
  });
  it('highlights the hovered bar', () => {
    expect(getBarClassName(true)).toBe('fill-paper');
    expect(getBarClassName(false)).toBe('fill-muted');
  });
});

describe('getShouldRefreshValueText', () => {
  it('refreshes when paused or first time', () => {
    expect(getShouldRefreshValueText({ lastMs: 0, nowMs: 10, isPlaying: false })).toBe(true);
    expect(getShouldRefreshValueText({ lastMs: null, nowMs: 10, isPlaying: true })).toBe(true);
  });
  it('throttles to once per second while playing', () => {
    expect(getShouldRefreshValueText({ lastMs: 0, nowMs: 999, isPlaying: true })).toBe(false);
    expect(getShouldRefreshValueText({ lastMs: 0, nowMs: 1000, isPlaying: true })).toBe(true);
  });
});
