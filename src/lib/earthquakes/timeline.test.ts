import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AGE_OPACITY_FLOOR,
  getAgeOpacity,
  getClampedT,
  getDefaultT,
  getHistogramBins,
  getHistogramUnit,
  getIntervalRange,
  getLoadedRange,
  getPassedItems,
  getPlaybackRange,
  getPlaybackSpeed,
  getPlaybackT,
  getShownCount,
  getShownEarthquakes,
  getSortedByTime,
  getTimelineRange,
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
  it.each([
    [1, 'hour'],
    [3, 'day'],
    [7, 'day'],
    [30, 'week'],
    [365, 'month'],
  ] as const)('is %s days → %s', (days, unit) => {
    expect(getHistogramUnit({ start: 0, end: days * DAY })).toBe(unit);
  });

  it('bins a year by month', () => {
    const loaded = { start: new Date(2026, 0, 15).getTime(), end: new Date(2026, 3, 2).getTime() };
    const bins = getHistogramBins([], loaded, 'month');
    expect(bins.map(({ start }) => new Date(start).getMonth())).toEqual([0, 1, 2, 3]);
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

describe('getTimelineRange', () => {
  const first = Date.parse('2026-10-03T10:00:00.000Z');
  const quakes = [getQuake(first + HOUR), getQuake(first)];
  const nowMs = Date.parse('2026-10-05T12:00:00.000Z');

  it('returns null for an empty list', () => {
    expect(getTimelineRange({ earthquakes: [], nowMs })).toBeNull();
  });

  it('starts at the first earthquake and ends at now', () => {
    expect(getTimelineRange({ earthquakes: quakes, nowMs })).toEqual({
      start: first,
      end: nowMs,
    });
  });

  it('never ends before the first earthquake', () => {
    expect(getTimelineRange({ earthquakes: quakes, nowMs: first - HOUR })).toEqual({
      start: first,
      end: first,
    });
  });

  it('extends histogram bins to now', () => {
    const range = getTimelineRange({ earthquakes: quakes, nowMs });
    const bins = range ? getHistogramBins(quakes, range, 'day') : [];
    const last = bins.at(-1);
    expect(last?.start).toBeLessThanOrEqual(nowMs);
    expect(last?.end).toBeGreaterThan(nowMs);
  });
});

describe('getPlaybackSpeed', () => {
  it('plays a 24 h interval in 48 s, so one hour takes 2 s', () => {
    const range = { start: 0, end: DAY };
    const speed = getPlaybackSpeed(range);

    expect(PLAYBACK_DURATION_MS).toBe(48_000);
    expect(range.start + 48_000 * speed).toBe(range.end);
    expect(range.start + 47_000 * speed).toBeLessThan(range.end);
    expect(HOUR / speed).toBe(2000);
  });

  it('plays a 7 d interval in 48 s, so one day takes about 7 s', () => {
    const speed = getPlaybackSpeed({ start: 0, end: 7 * DAY });

    expect((7 * DAY) / speed).toBe(48_000);
    expect(Math.round(DAY / speed / 1000)).toBe(7);
  });
});

describe('getShownCount', () => {
  const times = [10, 20, 20, 30];

  it('shows every item when live', () => {
    expect(getShownCount(times, null)).toBe(4);
  });

  it('counts the items at or before the playhead', () => {
    expect(getShownCount(times, 5)).toBe(0);
    expect(getShownCount(times, 10)).toBe(1);
    expect(getShownCount(times, 20)).toBe(3);
    expect(getShownCount(times, 29)).toBe(3);
    expect(getShownCount(times, 30)).toBe(4);
  });

  it('matches a plain filter of the list', () => {
    const quakes = [getQuake(40), getQuake(10), getQuake(25), getQuake(25), getQuake(5)];
    const sorted = getSortedByTime(quakes);
    const sortedTimes = sorted.map(({ time }) => time);

    for (const playhead of [0, 5, 24, 25, 39, 40, 100]) {
      expect(getShownCount(sortedTimes, playhead)).toBe(
        getShownEarthquakes(quakes, playhead).length,
      );
    }
  });
});

describe('getSortedByTime', () => {
  it('sorts a copy oldest first', () => {
    const quakes = [getQuake(3), getQuake(1), getQuake(2)];

    expect(getSortedByTime(quakes).map(({ time }) => time)).toEqual([1, 2, 3]);
    expect(quakes.map(({ time }) => time)).toEqual([3, 1, 2]);
  });
});

describe('getPassedItems', () => {
  const sorted = [getQuake(10), getQuake(20), getQuake(30)];
  const times = [10, 20, 30];

  it('returns the items the playhead passed since the last frame', () => {
    expect(getPassedItems(sorted, times, 10, 30).map(({ time }) => time)).toEqual([20, 30]);
    expect(getPassedItems(sorted, times, 0, 10).map(({ time }) => time)).toEqual([10]);
  });

  it('returns nothing when the playhead stood still, went back or was live', () => {
    expect(getPassedItems(sorted, times, 20, 20)).toEqual([]);
    expect(getPassedItems(sorted, times, 30, 10)).toEqual([]);
    expect(getPassedItems(sorted, times, null, 10)).toEqual([]);
    expect(getPassedItems(sorted, times, 10, null)).toEqual([]);
  });
});

describe('getShownEarthquakes', () => {
  it('returns the same list when live', () => {
    const quakes = [getQuake(1)];

    expect(getShownEarthquakes(quakes, null)).toBe(quakes);
  });

  it('keeps the earthquakes at or before the playhead', () => {
    const quakes = [getQuake(1), getQuake(5), getQuake(3)];

    expect(getShownEarthquakes(quakes, 3).map(({ time }) => time)).toEqual([1, 3]);
  });
});

describe('getIntervalRange', () => {
  it('ends at the fetch time and starts one interval before', () => {
    const fetchedAt = Date.parse('2026-11-02T12:00:00.000Z');

    expect(getIntervalRange({ interval: '24h' }, fetchedAt)).toEqual({
      start: fetchedAt - DAY,
      end: fetchedAt,
    });
    expect(getIntervalRange({ interval: '7d' }, fetchedAt)).toEqual({
      start: fetchedAt - 7 * DAY,
      end: fetchedAt,
    });
  });
});
