import { describe, expect, it } from 'vitest';

import { getFeltReachKm } from './intensity';
import { getSummaryIndex, getSummaryShownCount, getSummaryStats } from './summary';
import { getShownEarthquakes } from './timeline';
import type { Earthquake } from './types';

const HOUR = 3_600_000;

function getQuake(time: number, magnitude: number, place: string | null = null): Earthquake {
  return {
    id: `${time}`,
    source: 'emsc',
    magnitude,
    magnitudeType: null,
    place,
    time,
    depthKm: 10,
    longitude: 0,
    latitude: 0,
    url: '',
  };
}

const EARTHQUAKES = [
  getQuake(4 * HOUR, 5.1, 'CHILE'),
  getQuake(1 * HOUR, 0.4),
  getQuake(3 * HOUR, 6.4, 'EASTER ISLAND'),
  getQuake(2 * HOUR, 2.5),
  getQuake(5 * HOUR, 0.2),
];

function getExpectedStats(playhead: number | null) {
  const shown = getShownEarthquakes(EARTHQUAKES, playhead);
  const largest = shown.reduce<Earthquake | null>(
    (current, quake) => (current && current.magnitude >= quake.magnitude ? current : quake),
    null,
  );
  return {
    count: shown.length,
    feltCount: shown.filter((quake) => getFeltReachKm(quake) > 0).length,
    largest,
  };
}

describe('getSummaryStats', () => {
  it.each([null, 0, HOUR, 2.5 * HOUR, 3 * HOUR, 4.5 * HOUR, 6 * HOUR])(
    'matches the list filtered at playhead %s',
    (playhead) => {
      const index = getSummaryIndex(EARTHQUAKES);
      const stats = getSummaryStats(index, getSummaryShownCount(index, playhead));

      expect(stats).toEqual(getExpectedStats(playhead));
    },
  );

  it('counts only Likely felt Earthquakes', () => {
    const index = getSummaryIndex(EARTHQUAKES);
    const stats = getSummaryStats(index, getSummaryShownCount(index, null));

    expect(getFeltReachKm(EARTHQUAKES[4])).toBe(0);
    expect(stats.feltCount).toBeLessThan(stats.count);
  });

  it('keeps the earlier Earthquake as Largest so far on a magnitude tie', () => {
    const earlier = getQuake(HOUR, 4, 'FIRST');
    const index = getSummaryIndex([getQuake(2 * HOUR, 4, 'SECOND'), earlier]);

    expect(getSummaryStats(index, 2).largest).toBe(earlier);
  });

  it('has no Largest so far before the first Earthquake or with an empty list', () => {
    const index = getSummaryIndex(EARTHQUAKES);

    expect(getSummaryStats(index, 0)).toEqual({ count: 0, feltCount: 0, largest: null });
    expect(getSummaryStats(getSummaryIndex([]), 0)).toEqual({
      count: 0,
      feltCount: 0,
      largest: null,
    });
  });

  it('clamps a shown count above the list length', () => {
    const index = getSummaryIndex(EARTHQUAKES);

    expect(getSummaryStats(index, 99).count).toBe(EARTHQUAKES.length);
  });
});
