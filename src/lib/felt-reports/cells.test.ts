import { describe, expect, it } from 'vitest';

import { getCorrectedIntensity, getFeltReportCells } from './cells';
import type { FeltReport } from './csv';

function getReport(longitude: number, latitude: number, rawIntensity: number): FeltReport {
  return { longitude, latitude, time: '', rawIntensity };
}

describe('getCorrectedIntensity', () => {
  it('leaves values under 2.5 alone and applies 1.3*I - 0.75 from 2.5', () => {
    expect(getCorrectedIntensity(2)).toBe(2);
    expect(getCorrectedIntensity(2.49)).toBe(2.49);
    expect(getCorrectedIntensity(2.5)).toBeCloseTo(2.5);
    expect(getCorrectedIntensity(5)).toBeCloseTo(5.75);
  });
});

describe('getFeltReportCells', () => {
  it('drops raw Intensity 11 and 12', () => {
    const cells = getFeltReportCells([
      getReport(0, 0, 11),
      getReport(0, 0, 12),
      getReport(0, 0, 4),
    ]);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ count: 1 });
  });

  it('returns nothing when only invalid reports exist', () => {
    expect(getFeltReportCells([getReport(0, 0, 11), getReport(1, 1, 12)])).toEqual([]);
    expect(getFeltReportCells([])).toEqual([]);
  });

  it('bins nearby reports together and splits them across a cell edge', () => {
    const step = 10 / 111.32;
    const near = getFeltReportCells([
      getReport(10, step * 0.2, 4),
      getReport(10.01, step * 0.4, 4),
    ]);
    expect(near).toHaveLength(1);
    expect(near[0].count).toBe(2);

    const split = getFeltReportCells([
      getReport(10, step * 0.99, 4),
      getReport(10, step * 1.01, 4),
    ]);
    expect(split).toHaveLength(2);
  });

  it('keeps cells roughly square by widening the longitude step with latitude', () => {
    const equator = getFeltReportCells([getReport(0.01, 0.01, 4), getReport(0.12, 0.01, 4)]);
    const north = getFeltReportCells([getReport(0.01, 60.01, 4), getReport(0.12, 60.01, 4)]);
    expect(equator).toHaveLength(2);
    expect(north).toHaveLength(1);
  });

  it('applies the correction to the average, not to each report', () => {
    const [cell] = getFeltReportCells([getReport(0, 0, 2), getReport(0, 0, 3)]);
    const perReport = (getCorrectedIntensity(2) + getCorrectedIntensity(3)) / 2;
    expect(cell.mmi).toBeCloseTo(2.5);
    expect(cell.mmi).not.toBeCloseTo(perReport);
  });

  it('places the cell at the mean of its reports and counts them', () => {
    const [cell] = getFeltReportCells([getReport(10.001, 40.001, 4), getReport(10.003, 40.003, 6)]);
    expect(cell.longitude).toBeCloseTo(10.002);
    expect(cell.latitude).toBeCloseTo(40.002);
    expect(cell.count).toBe(2);
    expect(cell.mmi).toBeCloseTo(getCorrectedIntensity(5));
  });

  it('honours a custom cell size', () => {
    const reports = [getReport(0, 0.01, 4), getReport(0, 0.3, 4)];
    expect(getFeltReportCells(reports, 10)).toHaveLength(2);
    expect(getFeltReportCells(reports, 100)).toHaveLength(1);
  });

  it('survives reports at the poles', () => {
    expect(getFeltReportCells([getReport(0, 90, 4)])).toHaveLength(1);
  });

  it('averages longitudes across the antimeridian instead of landing near 0', () => {
    const [cell] = getFeltReportCells([getReport(179.99, 0.01, 4), getReport(180.01, 0.01, 4)]);
    expect(cell.count).toBe(2);
    expect(Math.abs(cell.longitude)).toBeCloseTo(180, 5);
  });

  it('keeps the centre inside [-180, 180)', () => {
    const [cell] = getFeltReportCells([getReport(190, 0.01, 4)]);
    expect(cell.longitude).toBeCloseTo(-170, 5);
  });
});
