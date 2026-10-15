import { describe, expect, it } from 'vitest';

import { getPaletteColor } from '@/lib/shakemap/coverage';

import type { FeltReportCell } from './cells';
import {
  getFeltReportsBounds,
  getFeltReportsViewBounds,
  getFramedCells,
  getNearestCells,
} from './framing';
import { FELT_REPORTS_PALETTE } from './palette';

const EPICENTER = { latitude: 8, longitude: -82 };

function getCell(longitude: number, latitude: number, mmi = 4, count = 3): FeltReportCell {
  return { longitude, latitude, mmi, count };
}

describe('FELT_REPORTS_PALETTE', () => {
  it('holds the 11 USGS MMI colours over [0, 10]', () => {
    expect(FELT_REPORTS_PALETTE.colors).toHaveLength(11);
    expect(FELT_REPORTS_PALETTE.extent).toEqual([0, 10]);
    expect(getPaletteColor(FELT_REPORTS_PALETTE, 9)).toEqual([1, 0, 0]);
  });
});

describe('getFeltReportsBounds', () => {
  it('wraps every cell, plus the Epicenter, into one box', () => {
    const [west, south, east, north] = getFeltReportsBounds(
      [getCell(-80, 9), getCell(-83, 7)],
      EPICENTER,
    );
    expect([west, south, east, north]).toEqual([-83, 7, -80, 9]);
  });

  it('pads by the given distance', () => {
    const [west, south] = getFeltReportsBounds([getCell(-82, 8)], EPICENTER, 10);
    expect(south).toBeLessThan(8);
    expect(west).toBeLessThan(-82);
  });

  it('keeps cells next to the antimeridian on one side of the Epicenter', () => {
    const epicenter = { latitude: 0, longitude: 179.9 };
    const [west, , east] = getFeltReportsBounds([getCell(-179.8, 0)], epicenter);
    expect(west).toBeCloseTo(179.9);
    expect(east).toBeCloseTo(180.2);
    expect(getFramedCells([getCell(-179.8, 0)], epicenter)[0].longitude).toBeCloseTo(180.2);
  });
});

describe('getNearestCells', () => {
  it('keeps the nearest 90% of the cells', () => {
    const near = Array.from({ length: 9 }, (_, index) => getCell(-82 + index * 0.01, 8));
    const far = getCell(-100, 20);
    const nearest = getNearestCells([far, ...near], EPICENTER);
    expect(nearest).toHaveLength(9);
    expect(nearest).not.toContain(far);
  });

  it('keeps at least one cell', () => {
    expect(getNearestCells([getCell(-81, 8)], EPICENTER)).toHaveLength(1);
    expect(getNearestCells([], EPICENTER)).toEqual([]);
  });
});

describe('getFeltReportsViewBounds', () => {
  it('leaves the farthest outliers out of the framing', () => {
    const near = Array.from({ length: 9 }, (_, index) => getCell(-82 + index * 0.01, 8, 4));
    const [west, , east] = getFeltReportsViewBounds([...near, getCell(-100, 20)], EPICENTER);
    expect(west).toBeGreaterThan(-83);
    expect(east).toBeLessThan(-81);
  });

  it('frames a single cell with the Epicenter', () => {
    const [west, , east] = getFeltReportsViewBounds([getCell(-81, 8)], EPICENTER);
    expect(west).toBeLessThan(-82);
    expect(east).toBeGreaterThan(-81);
  });
});
