import { describe, expect, it } from 'vitest';

import {
  AREA_MIN_RADIUS_KM,
  getAreaEarthquakes,
  getAreaStrip,
  getStripDotRadius,
  getStripTicks,
} from './area-strip';
import type { Earthquake } from './types';

const RANGE = {
  start: Date.UTC(2026, 9, 26, 17, 36),
  end: Date.UTC(2026, 10, 2, 17, 36),
};
const STRIP_X0 = 560;
const STRIP_WIDTH = 824;

function getEarthquake(overrides: Partial<Earthquake>): Earthquake {
  return {
    id: 'a',
    source: 'emsc',
    magnitude: 4,
    magnitudeType: 'mb',
    place: null,
    time: RANGE.start,
    depthKm: 10,
    longitude: 167.2,
    latitude: -15,
    url: '',
    ...overrides,
  };
}

function getBoardX(fraction: number): number {
  return STRIP_X0 + fraction * STRIP_WIDTH;
}

describe('getAreaEarthquakes', () => {
  it('keeps the earthquakes within 300 km when the selected one is felt less far', () => {
    const selected = getEarthquake({ id: 'sel', magnitude: 3, depthKm: 200 });
    const near = getEarthquake({ id: 'near', latitude: -17.6 });
    const far = getEarthquake({ id: 'far', latitude: -17.8 });

    expect(AREA_MIN_RADIUS_KM).toBe(300);
    expect(getAreaEarthquakes([selected, near, far], selected).map(({ id }) => id)).toEqual([
      'sel',
      'near',
    ]);
  });

  it('widens the area to the felt reach of a larger earthquake', () => {
    const selected = getEarthquake({ id: 'sel', magnitude: 6.2, depthKm: 143 });
    const far = getEarthquake({ id: 'far', latitude: -18.5 });

    expect(getAreaEarthquakes([selected, far], selected)).toHaveLength(2);
  });
});

describe('getStripDotRadius', () => {
  it('sizes dots by magnitude as the design does, 5.8 px for M4.6 and 8.7 px for M6.2', () => {
    expect(getStripDotRadius(4.6)).toBeCloseTo(5.8, 1);
    expect(getStripDotRadius(6.2)).toBeCloseTo(8.7, 1);
  });

  it('keeps tiny and huge magnitudes readable inside the strip', () => {
    expect(getStripDotRadius(1)).toBeCloseTo(3.49, 2);
    expect(getStripDotRadius(9.5)).toBeCloseTo(9.67, 2);
  });
});

describe('getStripTicks', () => {
  it('ticks each UTC midnight of a week, as the design does from Tue 27 to Mon 02', () => {
    const ticks = getStripTicks(RANGE, '7d');

    expect(ticks.map(({ time }) => new Date(time).toISOString().slice(5, 10))).toEqual([
      '10-27',
      '10-28',
      '10-29',
      '10-30',
      '10-31',
      '11-01',
      '11-02',
    ]);
    expect(ticks.every(({ kind }) => kind === 'day')).toBe(true);
    expect(getBoardX(ticks[0].x)).toBeCloseTo(591.4, 1);
    expect(getBoardX(ticks[1].x)).toBeCloseTo(709.1, 1);
  });

  it('ticks every three hours over 24 hours and marks the midnight as a day', () => {
    const ticks = getStripTicks(
      { start: Date.UTC(2026, 9, 26, 17, 36), end: Date.UTC(2026, 9, 27, 17, 36) },
      '24h',
    );

    expect(ticks.map(({ time }) => new Date(time).getUTCHours())).toEqual([
      18, 21, 0, 3, 6, 9, 12, 15,
    ]);
    expect(ticks.map(({ kind }) => kind)).toEqual([
      'hour',
      'hour',
      'day',
      'hour',
      'hour',
      'hour',
      'hour',
      'hour',
    ]);
  });
});

describe('getAreaStrip', () => {
  const selected = getEarthquake({
    id: 'sel',
    magnitude: 6.2,
    time: Date.UTC(2026, 9, 29, 21, 48),
  });

  it('places the selected earthquake where the design draws Thu 21:48', () => {
    const strip = getAreaStrip({ earthquakes: [selected], selected, range: RANGE });

    expect(getBoardX(strip.selected.x)).toBeCloseTo(933.7, 1);
    expect(strip.selected.radius).toBeCloseTo(8.7, 1);
    expect(strip.isLabelAtEnd).toBe(false);
  });

  it('draws the others smallest first so larger dots stay on top', () => {
    const strip = getAreaStrip({
      earthquakes: [
        getEarthquake({ id: 'big', magnitude: 5, time: Date.UTC(2026, 9, 27, 3) }),
        selected,
        getEarthquake({ id: 'small', magnitude: 3.5, time: Date.UTC(2026, 9, 31, 3) }),
      ],
      selected,
      range: RANGE,
    });

    expect(strip.dots.map(({ id }) => id)).toEqual(['small', 'big']);
    expect(strip.dots[0].radius).toBe(getStripDotRadius(3.5));
  });

  it('keeps every dot inside the strip and turns the label near the right end', () => {
    const late = getEarthquake({ id: 'late', magnitude: 2, time: RANGE.end + 1000 });
    const strip = getAreaStrip({ earthquakes: [late], selected: late, range: RANGE });

    expect(strip.selected.x).toBe(1);
    expect(strip.selected.radius).toBe(4);
    expect(strip.isLabelAtEnd).toBe(true);
  });
});
