import { describe, expect, it } from 'vitest';

import { getWaveLifeSeconds } from '@/lib/globe/felt-rings';

import { getDepthColor } from './depth-color';
import {
  TIME_RING_LOOK,
  getActiveRingTicks,
  getNeedleEarthquake,
  getPastWedgePath,
  getRingAngle,
  getRingBarLength,
  getRingBarsPath,
  getRingFraction,
  getRingFractionAt,
  getRingMarks,
  getRingOpacity,
  getRingPoint,
  getRingTicks,
  getScrubStepMs,
  getSpeedLabel,
  isRingLabelBlocked,
} from './time-ring';
import { getPlaybackSpeed } from './timeline';
import type { Earthquake } from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MONDAY = Date.parse('2026-11-02T00:00:00.000Z');

function getQuake(id: string, time: number, magnitude = 3): Earthquake {
  return {
    id,
    source: 'emsc',
    magnitude,
    magnitudeType: null,
    place: null,
    time,
    depthKm: 10,
    longitude: 0,
    latitude: 0,
    url: '',
  };
}

describe('getRingTicks', () => {
  const range = { start: 0, end: 10 * HOUR };

  it('draws one tick per Earthquake of the filtered list inside the interval', () => {
    const quakes = [
      getQuake('a', 0),
      getQuake('b', 5 * HOUR, 5),
      getQuake('c', 10 * HOUR, 7),
      getQuake('early', -1),
      getQuake('late', 10 * HOUR + 1),
    ];

    expect(getRingTicks(quakes, range)).toMatchObject([
      { id: 'a', time: 0, fraction: 0, length: getRingBarLength(3) },
      { id: 'b', time: 5 * HOUR, fraction: 0.5, length: getRingBarLength(5) },
      { id: 'c', time: 10 * HOUR, fraction: 1, length: getRingBarLength(7) },
    ]);
  });

  it('colours each tick by depth and keeps it active for its wave life in data time', () => {
    const [tick] = getRingTicks([{ ...getQuake('a', HOUR, 6.4), depthKm: 650 }], range);

    expect(tick.color).toBe(getDepthColor(650));
    expect(tick.activeMs).toBe(getWaveLifeSeconds(6.4) * 1000 * getPlaybackSpeed(range));
  });

  it('marks as active only the ticks the playhead passed within their wave life', () => {
    const ticks = getRingTicks(
      [getQuake('old', 0, 7), getQuake('recent', 4 * HOUR, 7), getQuake('future', 6 * HOUR, 7)],
      range,
    );
    const playhead = 4 * HOUR + ticks[1].activeMs / 2;

    expect(getActiveRingTicks(ticks, playhead).map(({ id }) => id)).toEqual(['recent']);
    expect(getActiveRingTicks(ticks, 4 * HOUR + ticks[1].activeMs + 1)).toEqual([]);
  });

  it('draws one path segment per tick', () => {
    const ticks = getRingTicks([getQuake('a', 0), getQuake('b', HOUR)], range);

    expect(getRingBarsPath(ticks).match(/M/g)).toHaveLength(2);
    expect(getRingBarsPath([])).toBe('');
  });
});

describe('getRingBarLength', () => {
  it('grows 10 px per magnitude above 3.6 from 3 px, up to 40 px', () => {
    expect(getRingBarLength(2)).toBe(3);
    expect(getRingBarLength(3.6)).toBe(3);
    expect(getRingBarLength(5.1)).toBeCloseTo(18, 9);
    expect(getRingBarLength(9)).toBe(40);
    expect(getRingBarLength(Number.NaN)).toBe(3);
  });
});

describe('ring angles', () => {
  it('starts past the gap at the top and runs clockwise', () => {
    const start = getRingPoint(getRingAngle(0), 100);
    const quarter = getRingPoint(getRingAngle(0.25), 100);

    expect(start.y).toBeLessThan(-99);
    expect(start.x).toBeGreaterThan(0);
    expect(quarter.x).toBeGreaterThan(99);
  });

  it('maps a click at x% of the ring back to x% of the interval', () => {
    for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const point = getRingPoint(getRingAngle(fraction), TIME_RING_LOOK.radius);
      expect(getRingFractionAt(point.x, point.y)).toBeCloseTo(fraction, 9);
    }
  });

  it('snaps a click inside the top gap to the nearest end', () => {
    expect(getRingFractionAt(-1, -100)).toBe(1);
    expect(getRingFractionAt(1, -100)).toBe(0);
  });

  it('places a time by its share of the interval', () => {
    const range = { start: 100, end: 200 };

    expect(getRingFraction(150, range)).toBe(0.5);
    expect(getRingFraction(50, range)).toBe(0);
    expect(getRingFraction(250, range)).toBe(1);
    expect(getRingFraction(5, { start: 5, end: 5 })).toBe(1);
  });
});

describe('getPastWedgePath', () => {
  it('is empty before the start', () => {
    expect(getPastWedgePath(0, 400)).toBe('M0 0Z');
  });

  it('uses the large arc past half the ring', () => {
    expect(getPastWedgePath(0.25, 400)).toContain('A400 400 0 0 1');
    expect(getPastWedgePath(0.75, 400)).toContain('A400 400 0 1 1');
  });
});

describe('getRingMarks', () => {
  it('marks each UTC day of a 7 d interval and labels the inner ones', () => {
    const range = { start: MONDAY - 7 * DAY + 6 * HOUR, end: MONDAY + 6 * HOUR };
    const marks = getRingMarks(range, 'en');

    expect(marks).toHaveLength(7);
    expect(marks.map(({ label }) => label)).toEqual([
      'Tue 27',
      'Wed 28',
      'Thu 29',
      'Fri 30',
      'Sat 31',
      'Sun 01',
      'Mon 02',
    ]);
    expect(marks[0]?.fraction).toBeCloseTo(18 / 168, 9);
  });

  it('marks every 3 h of a 24 h interval with hour labels', () => {
    const range = { start: MONDAY - DAY, end: MONDAY };
    const marks = getRingMarks(range, 'en');

    expect(marks).toHaveLength(9);
    expect(marks[0]).toEqual({ fraction: 0, label: null });
    expect(marks[1]).toEqual({ fraction: 0.125, label: '03:00' });
    expect(marks.at(-1)).toEqual({ fraction: 1, label: null });
  });

  it('speaks Spanish weekdays without the abbreviation dot', () => {
    const range = { start: MONDAY - 3 * DAY + 6 * HOUR, end: MONDAY + 6 * HOUR };

    expect(getRingMarks(range, 'es').map(({ label }) => label)).toEqual([
      'sáb 31',
      'dom 01',
      'lun 02',
    ]);
  });
});

describe('getRingMarks over long ranges', () => {
  it('marks each Monday of a month-long range by day and month', () => {
    const range = { start: Date.UTC(2026, 9, 1), end: Date.UTC(2026, 9, 31) };
    expect(getRingMarks(range, 'en').map(({ label }) => label)).toEqual([
      '05 Oct',
      '12 Oct',
      '19 Oct',
      '26 Oct',
    ]);
  });

  it('marks each month of a year by name', () => {
    const range = { start: Date.UTC(2025, 10, 20, 12), end: Date.UTC(2026, 10, 20, 12) };
    const labels = getRingMarks(range, 'es').map(({ label }) => label);
    expect(labels).toHaveLength(12);
    expect(labels.at(1)).toBe('ene');
  });
});

describe('getSpeedLabel', () => {
  it('names the playback speed per interval', () => {
    expect(getSpeedLabel({ start: 0, end: DAY }, 'en')).toBe('1 hour ≈ 2 s');
    expect(getSpeedLabel({ start: 0, end: 3 * DAY }, 'en')).toBe('1 day ≈ 16 s');
    expect(getSpeedLabel({ start: 0, end: 7 * DAY }, 'en')).toBe('1 day ≈ 7 s');
    expect(getSpeedLabel({ start: 0, end: 7 * DAY }, 'es')).toBe('1 día ≈ 7 s');
    expect(getSpeedLabel({ start: 0, end: 30 * DAY }, 'en')).toBe('1 week ≈ 11 s');
    expect(getSpeedLabel({ start: 0, end: 365 * DAY }, 'en')).toBe('1 month ≈ 4 s');
    expect(getSpeedLabel({ start: 0, end: 365 * DAY }, 'pt')).toBe('1 mês ≈ 4 s');
  });
});

describe('getScrubStepMs', () => {
  it('moves one 48th of the interval, the span of one second of playback', () => {
    expect(getScrubStepMs({ start: 0, end: DAY })).toBe(30 * 60_000);
  });
});

describe('getRingOpacity', () => {
  it('shows the ring at the overview zoom and fades it out by zoom 1.48', () => {
    expect(getRingOpacity(undefined)).toBe(1);
    expect(getRingOpacity(1)).toBe(1);
    expect(getRingOpacity(1.28)).toBeCloseTo(0.5, 9);
    expect(getRingOpacity(2)).toBe(0);
  });
});

describe('getNeedleEarthquake', () => {
  const range = { start: 0, end: 7 * DAY };

  it('picks the largest Earthquake shortly before the playhead', () => {
    const quakes = [
      getQuake('old', 0, 7),
      getQuake('small', 3 * DAY, 4),
      getQuake('large', 3 * DAY + HOUR, 6),
      getQuake('future', 3 * DAY + 3 * HOUR, 8),
    ];

    expect(getNeedleEarthquake(quakes, 3 * DAY + 2 * HOUR, range)?.id).toBe('large');
  });

  it('finds nothing in a quiet stretch', () => {
    expect(getNeedleEarthquake([getQuake('old', 0, 7)], 3 * DAY, range)).toBeUndefined();
  });
});

describe('isRingLabelBlocked', () => {
  const panel = { left: 1154, top: 159, right: 1384, bottom: 460 };

  it('blocks a label that overlaps a panel or comes within 8 px of it', () => {
    expect(isRingLabelBlocked({ left: 1118, top: 456, right: 1158, bottom: 468 }, [panel])).toBe(
      true,
    );
    expect(isRingLabelBlocked({ left: 1110, top: 370, right: 1149, bottom: 382 }, [panel])).toBe(
      true,
    );
  });

  it('keeps a label more than 8 px clear of every panel', () => {
    expect(isRingLabelBlocked({ left: 1078, top: 280, right: 1119, bottom: 292 }, [panel])).toBe(
      false,
    );
    expect(isRingLabelBlocked({ left: 1110, top: 470, right: 1149, bottom: 482 }, [panel])).toBe(
      false,
    );
    expect(isRingLabelBlocked({ left: 1110, top: 370, right: 1149, bottom: 382 }, [])).toBe(false);
  });
});
