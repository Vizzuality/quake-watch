import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AGE_OPACITY_FLOOR,
  getAgeOpacity,
  getClampedT,
  getDefaultT,
  getHistogramBins,
  getHistogramUnit,
  getLoadedRange,
  getPlaybackRange,
  getPlaybackT,
  getWindowMs,
  PLAYBACK_DURATION_MS,
} from './timeline';
import type { Earthquake } from './types';

const HOUR = 3_600_000;
const DAY = 86_400_000;

function getQuake(time: number): Earthquake {
  return {
    id: String(time),
    source: 'emsc',
    magnitude: 3,
    magnitudeType: null,
    place: null,
    time,
    depthKm: 10,
    longitude: 0,
    latitude: 0,
    url: '',
  };
}

describe('getLoadedRange', () => {
  it('returns null for an empty list', () => {
    expect(getLoadedRange([])).toBeNull();
  });

  it('spans first to last regardless of order', () => {
    expect(getLoadedRange([getQuake(500), getQuake(100), getQuake(300)])).toEqual({
      start: 100,
      end: 500,
    });
  });

  it('has zero length for a single earthquake', () => {
    expect(getLoadedRange([getQuake(42)])).toEqual({ start: 42, end: 42 });
  });
});

describe('getWindowMs', () => {
  it('maps windows to milliseconds', () => {
    expect(getWindowMs('24h')).toBe(DAY);
    expect(getWindowMs('7d')).toBe(7 * DAY);
  });
});

describe('getPlaybackRange', () => {
  const loaded = { start: 10 * DAY, end: 20 * DAY };

  it('starts one window before t', () => {
    expect(getPlaybackRange({ loaded, window: '24h', t: 15 * DAY })).toEqual({
      start: 14 * DAY,
      end: 15 * DAY,
    });
  });

  it('never starts before the loaded start', () => {
    expect(getPlaybackRange({ loaded, window: '7d', t: 11 * DAY })).toEqual({
      start: 10 * DAY,
      end: 11 * DAY,
    });
  });

  it('is well-formed for a zero-length loaded range', () => {
    const range = getPlaybackRange({ loaded: { start: 5, end: 5 }, window: '24h', t: 5 });
    expect(range).toEqual({ start: 5, end: 5 });
  });
});

describe('getDefaultT', () => {
  it('is the loaded end', () => {
    expect(getDefaultT({ start: 1, end: 9 })).toBe(9);
  });
});

describe('getClampedT', () => {
  const loaded = {
    start: Date.parse('2026-10-01T00:00:00.000Z'),
    end: Date.parse('2026-10-08T00:00:00.000Z'),
  };

  it('returns null without a loaded range', () => {
    expect(getClampedT('2026-10-02T00:00:00.000Z', null)).toBeNull();
    expect(getClampedT(undefined, null)).toBeNull();
  });

  it('defaults to loaded end when missing or unparseable', () => {
    expect(getClampedT(undefined, loaded)).toBe(loaded.end);
    expect(getClampedT('banana', loaded)).toBe(loaded.end);
  });

  it('clamps into the loaded range', () => {
    expect(getClampedT('2026-09-01T00:00:00.000Z', loaded)).toBe(loaded.start);
    expect(getClampedT('2026-11-01T00:00:00.000Z', loaded)).toBe(loaded.end);
  });

  it('returns a valid instant inside the range', () => {
    expect(getClampedT('2026-10-03T10:00:00.123Z', loaded)).toBe(
      Date.parse('2026-10-03T10:00:00.123Z'),
    );
  });
});

describe('getHistogramUnit', () => {
  it('is hourly for 24h and daily otherwise', () => {
    expect(getHistogramUnit('24h')).toBe('hour');
    expect(getHistogramUnit('7d')).toBe('day');
    expect(getHistogramUnit('custom')).toBe('day');
  });
});

describe('getHistogramBins', () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'UTC';
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('builds one bin for a single earthquake', () => {
    const quakes = [getQuake(5 * HOUR + 10)];
    const bins = getHistogramBins(quakes, { start: 5 * HOUR + 10, end: 5 * HOUR + 10 }, 'hour');
    expect(bins).toEqual([{ start: 5 * HOUR, end: 6 * HOUR, count: 1 }]);
  });

  it('is aligned to UTC hours in UTC, contiguous, and sums to the input length', () => {
    const quakes = [
      getQuake(2 * HOUR + 1),
      getQuake(2 * HOUR + 2),
      getQuake(4 * HOUR + 30),
      getQuake(7 * HOUR + 59),
    ];
    const loaded = { start: 2 * HOUR + 1, end: 7 * HOUR + 59 };
    const bins = getHistogramBins(quakes, loaded, 'hour');
    expect(bins[0]?.start).toBe(2 * HOUR);
    expect(bins).toHaveLength(6);
    bins.slice(1).forEach((bin, i) => expect(bin.start).toBe(bins[i]?.end));
    expect(bins.map((bin) => bin.count)).toEqual([2, 0, 1, 0, 0, 1]);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(quakes.length);
  });

  it('puts an earthquake exactly on loaded.end in the last bin', () => {
    const quakes = [getQuake(0), getQuake(2 * HOUR)];
    const bins = getHistogramBins(quakes, { start: 0, end: 2 * HOUR }, 'hour');
    expect(bins).toHaveLength(3);
    expect(bins.at(-1)?.count).toBe(1);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(2);
  });

  it('uses UTC midnight day bins in UTC', () => {
    const quakes = [getQuake(DAY / 2), getQuake(DAY + 1), getQuake(2 * DAY + 5)];
    const bins = getHistogramBins(quakes, { start: DAY / 2, end: 2 * DAY + 5 }, 'day');
    expect(bins.map((bin) => bin.start)).toEqual([0, DAY, 2 * DAY]);
    expect(bins.map((bin) => bin.count)).toEqual([1, 1, 1]);
  });

  it('ignores earthquakes outside the loaded range', () => {
    const quakes = [getQuake(0), getQuake(10 * HOUR)];
    const bins = getHistogramBins(quakes, { start: 0, end: HOUR }, 'hour');
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(1);
  });

  it('cuts day bins at local midnight in Madrid summer', () => {
    process.env.TZ = 'Europe/Madrid';
    const time = Date.parse('2026-08-14T23:30:00Z');
    const bins = getHistogramBins([getQuake(time)], { start: time, end: time }, 'day');
    expect(bins).toHaveLength(1);
    expect(bins[0]?.start).toBe(Date.parse('2026-08-14T22:00:00Z'));
    expect(bins[0]?.end).toBe(Date.parse('2026-08-15T22:00:00Z'));
    expect(bins[0]?.count).toBe(1);
  });

  it('makes the day bin 25 h long when DST ends in Madrid', () => {
    process.env.TZ = 'Europe/Madrid';
    const time = Date.parse('2026-10-25T12:00:00Z');
    const bins = getHistogramBins([getQuake(time)], { start: time, end: time }, 'day');
    expect(bins).toHaveLength(1);
    expect((bins[0]?.end ?? 0) - (bins[0]?.start ?? 0)).toBe(25 * HOUR);
  });

  it('makes the day bin 23 h long when DST starts in Madrid', () => {
    process.env.TZ = 'Europe/Madrid';
    const time = Date.parse('2026-03-29T12:00:00Z');
    const bins = getHistogramBins([getQuake(time)], { start: time, end: time }, 'day');
    expect(bins).toHaveLength(1);
    expect((bins[0]?.end ?? 0) - (bins[0]?.start ?? 0)).toBe(23 * HOUR);
  });

  it('cuts hour bins at local hour starts in Asia/Kolkata', () => {
    process.env.TZ = 'Asia/Kolkata';
    const start = Date.parse('2026-10-01T10:45:00Z');
    const end = Date.parse('2026-10-01T12:10:00Z');
    const bins = getHistogramBins([getQuake(start), getQuake(end)], { start, end }, 'hour');
    expect(bins.map((bin) => bin.start)).toEqual([
      Date.parse('2026-10-01T10:30:00Z'),
      Date.parse('2026-10-01T11:30:00Z'),
    ]);
    expect(bins.map((bin) => bin.count)).toEqual([1, 1]);
  });
});

describe('getAgeOpacity', () => {
  it('decays linearly to the floor', () => {
    expect(getAgeOpacity(0, DAY)).toBe(1);
    expect(getAgeOpacity(DAY / 2, DAY)).toBeCloseTo(0.625);
    expect(getAgeOpacity(DAY, DAY)).toBe(AGE_OPACITY_FLOOR);
    expect(getAgeOpacity(2 * DAY, DAY)).toBe(AGE_OPACITY_FLOOR);
  });

  it('is zero for the future', () => {
    expect(getAgeOpacity(-1, DAY)).toBe(0);
  });
});

describe('getPlaybackT', () => {
  const range = { start: 1000, end: 31_000 };

  it('maps elapsed time linearly onto the range', () => {
    expect(getPlaybackT({ range, elapsedMs: 0 })).toBe(1000);
    expect(getPlaybackT({ range, elapsedMs: PLAYBACK_DURATION_MS / 2 })).toBe(16_000);
    expect(getPlaybackT({ range, elapsedMs: PLAYBACK_DURATION_MS })).toBe(31_000);
  });

  it('clamps after the duration', () => {
    expect(getPlaybackT({ range, elapsedMs: PLAYBACK_DURATION_MS * 3 })).toBe(31_000);
  });

  it('returns the end for a zero-span range', () => {
    expect(getPlaybackT({ range: { start: 5, end: 5 }, elapsedMs: 100 })).toBe(5);
  });
});
