import { describe, expect, it } from 'vitest';

import { getEvaluatedNumber, getEvaluatedValue } from '@/test/evaluate-expression';

import {
  MAX_BUBBLE_RADIUS_PX,
  MIN_BUBBLE_RADIUS_PX,
  getBubbleFeatures,
  getBubbleRadius,
  getBubbleTextColorExpression,
  getSettledBubbleColorExpression,
  getSettledBubbleRadiusExpression,
} from './bubbles';
import type { FeltReportCell } from './cells';
import { FELT_REPORTS_PALETTE } from './palette';

function getCell(longitude: number, latitude: number, mmi = 4, count = 3): FeltReportCell {
  return { longitude, latitude, mmi, count };
}

describe('getBubbleFeatures', () => {
  it('turns each cell into a point with its reports and weighted Intensity', () => {
    const [feature] = getBubbleFeatures([getCell(-81.5, 8.2, 5, 4)]).features;
    expect(feature.geometry.coordinates).toEqual([-81.5, 8.2]);
    expect(feature.properties).toEqual({ reports: 4, mmiReports: 20 });
  });

  it('keeps cells across the antimeridian at their own longitude for the cluster index', () => {
    const [feature] = getBubbleFeatures([getCell(-179.8, 0)]).features;
    expect(feature.geometry.coordinates[0]).toBe(-179.8);
  });
});

describe('getBubbleRadius', () => {
  it('grows with the number of reports, between a floor and a cap', () => {
    expect(getBubbleRadius(0)).toBe(MIN_BUBBLE_RADIUS_PX);
    expect(getBubbleRadius(1)).toBeLessThan(getBubbleRadius(48));
    expect(getBubbleRadius(1_000_000)).toBe(MAX_BUBBLE_RADIUS_PX);
  });
});

describe('getSettledBubbleRadiusExpression', () => {
  it('is min(MAX, MIN + K·sqrt(reports)) for any report count', () => {
    const radius = getSettledBubbleRadiusExpression();
    for (const reports of [0, 1, 4, 48, 400, 1_000_000]) {
      expect(getEvaluatedNumber(radius, { reports })).toBeCloseTo(getBubbleRadius(reports));
    }
    expect(getEvaluatedNumber(radius, { reports: 1_000_000 })).toBe(MAX_BUBBLE_RADIUS_PX);
  });
});

describe('getSettledBubbleColorExpression', () => {
  it('colours a bubble with the palette stop of its weighted mean Intensity', () => {
    const color = getSettledBubbleColorExpression(FELT_REPORTS_PALETTE);
    const { colors, extent } = FELT_REPORTS_PALETTE;
    const step = (extent[1] - extent[0]) / (colors.length - 1);
    colors.forEach((stopColor, index) => {
      const mmi = extent[0] + step * index;
      expect(getEvaluatedValue(color, { reports: 4, mmiReports: mmi * 4 })).toBe(stopColor);
    });
  });

  it('clamps Intensities outside the palette extent to its end colours', () => {
    const color = getSettledBubbleColorExpression(FELT_REPORTS_PALETTE);
    expect(getEvaluatedValue(color, { reports: 1, mmiReports: 12 })).toBe(
      FELT_REPORTS_PALETTE.colors.at(-1),
    );
  });
});

describe('getBubbleTextColorExpression', () => {
  it('writes light text on the darkest reds only, by the weighted mean', () => {
    const textColor = getBubbleTextColorExpression();
    const dark = getEvaluatedValue(textColor, { reports: 48, mmiReports: 48 * 6 });
    const light = getEvaluatedValue(textColor, { reports: 48, mmiReports: 48 * 9 });
    expect(dark).not.toBe(light);
    expect(light).toBe('rgb(255, 255, 255)');
  });
});
