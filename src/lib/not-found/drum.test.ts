import { describe, expect, it } from 'vitest';

import { DRUM_TILE_WIDTH, getRowPoints, getSeededRandom } from './drum';

function getYs(points: string): number[] {
  return points.split(' ').map((point) => Number(point.split(',')[1]));
}

describe('getSeededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = getSeededRandom(7);
    const second = getSeededRandom(7);
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it('stays within [0, 1)', () => {
    const random = getSeededRandom(1);
    const values = Array.from({ length: 500 }, random);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });
});

describe('getRowPoints', () => {
  it('spans one tile and starts and ends on the baseline so the tiles join', () => {
    const points = getRowPoints({ y: 40, random: getSeededRandom(3) }).split(' ');
    expect(points.at(0)).toBe('0,40');
    expect(points.at(-1)).toBe(`${DRUM_TILE_WIDTH},40`);
  });

  it('stays within 7 units of the baseline', () => {
    const ys = getYs(getRowPoints({ y: 40, random: getSeededRandom(5) }));
    expect(Math.max(...ys.map((y) => Math.abs(y - 40)))).toBeLessThanOrEqual(7);
  });

  it('draws the same row for the same seed', () => {
    expect(getRowPoints({ y: 40, random: getSeededRandom(9) })).toBe(
      getRowPoints({ y: 40, random: getSeededRandom(9) }),
    );
  });

  it('wiggles more than background noise somewhere along the row', () => {
    const ys = getYs(getRowPoints({ y: 40, random: getSeededRandom(11) }));
    expect(Math.max(...ys.map((y) => Math.abs(y - 40)))).toBeGreaterThan(1.5);
  });
});
