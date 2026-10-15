import { describe, expect, it } from 'vitest';

import { getDistanceKm } from '@/lib/earthquakes/distance';
import {
  getPulse,
  getPulseLengthSeconds,
  S_WAVE_KM_S,
  getArrivalSeconds,
} from '@/lib/shakemap/wave';
import { getEvaluatedNumber, getEvaluatedValue } from '@/test/evaluate-expression';

import {
  BUBBLE_SECONDS_STATE,
  type BubbleProperties,
  MAX_BUBBLE_RADIUS_PX,
  MIN_BUBBLE_RADIUS_PX,
  SETTLED_BUBBLE_OPACITY,
  getBubbleFeatures,
  getBubbleMmi,
  getBubbleOpacityExpression,
  getBubbleProperties,
  getBubbleRadius,
  getBubbleRadiusExpression,
  getBubbleSeconds,
  getBubbleTextColorExpression,
  getFramedRunEndSeconds,
  getIsBubbleArrived,
  getStrongestCell,
} from './bubbles';
import type { FeltReportCell } from './cells';

const EPICENTER = { latitude: 8, longitude: -82 };
const DEPTH_KM = 20;

function getCell(longitude: number, latitude: number, mmi = 4, count = 3): FeltReportCell {
  return { longitude, latitude, mmi, count };
}

function getClusterProperties(members: readonly BubbleProperties[]): BubbleProperties {
  return members.reduce((sum, member) => ({
    reports: sum.reports + member.reports,
    mmiReports: sum.mmiReports + member.mmiReports,
    arrival: Math.min(sum.arrival, member.arrival),
  }));
}

describe('getBubbleFeatures', () => {
  it('turns each cell into a point with its reports, weighted Intensity and S arrival', () => {
    const cell = getCell(-81.5, 8.2, 5, 4);
    const [feature] = getBubbleFeatures([cell], EPICENTER, DEPTH_KM).features;
    expect(feature.geometry.coordinates).toEqual([-81.5, 8.2]);
    expect(feature.properties.reports).toBe(4);
    expect(feature.properties.mmiReports).toBe(20);
    expect(feature.properties.arrival).toBeCloseTo(
      getArrivalSeconds(getDistanceKm(EPICENTER, cell), DEPTH_KM, S_WAVE_KM_S),
    );
  });

  it('keeps cells across the antimeridian at their wrapped longitude for the cluster index', () => {
    const epicenter = { latitude: 0, longitude: 179.9 };
    const cell = getCell(-179.8, 0);
    const [feature] = getBubbleFeatures([cell], epicenter, 10).features;
    expect(feature.geometry.coordinates[0]).toBe(-179.8);
    expect(feature.properties.arrival).toBeCloseTo(
      getArrivalSeconds(getDistanceKm(epicenter, cell), 10, S_WAVE_KM_S),
    );
  });
});

describe('getBubbleMmi', () => {
  it('is the report-weighted mean Intensity of a cluster', () => {
    const cells = [getCell(-82, 8, 4, 23), getCell(-81.9, 8, 6, 1), getCell(-81.8, 8, 2, 4)];
    const cluster = getClusterProperties(
      getBubbleFeatures(cells, EPICENTER, DEPTH_KM).features.map(({ properties }) => properties),
    );
    expect(cluster.reports).toBe(28);
    expect(getBubbleMmi(cluster)).toBeCloseTo((4 * 23 + 6 + 2 * 4) / 28);
  });
});

describe('getBubbleProperties', () => {
  it('reads cluster and cell properties from a rendered feature', () => {
    expect(
      getBubbleProperties({ reports: 2, mmiReports: 9, arrival: 4, cluster: true, point_count: 2 }),
    ).toEqual({ reports: 2, mmiReports: 9, arrival: 4 });
  });

  it('rejects missing, malformed or empty properties', () => {
    expect(getBubbleProperties(null)).toBeNull();
    expect(getBubbleProperties({ reports: '2', mmiReports: 9, arrival: 4 })).toBeNull();
    expect(getBubbleProperties({ reports: 2, mmiReports: Number.NaN, arrival: 4 })).toBeNull();
    expect(getBubbleProperties({ reports: 2, mmiReports: 9 })).toBeNull();
    expect(getBubbleProperties({ reports: 0, mmiReports: 0, arrival: 4 })).toBeNull();
  });
});

describe('getIsBubbleArrived', () => {
  const bubble = { reports: 1, mmiReports: 4, arrival: 10 };

  it('is true once the S wave has reached it, or when the run is complete', () => {
    expect(getIsBubbleArrived(bubble, 9, false)).toBe(false);
    expect(getIsBubbleArrived(bubble, 10, false)).toBe(true);
    expect(getIsBubbleArrived(bubble, 0, true)).toBe(true);
  });
});

describe('getBubbleRadius', () => {
  it('grows with the number of reports, between a floor and a cap', () => {
    expect(getBubbleRadius(0)).toBe(MIN_BUBBLE_RADIUS_PX);
    expect(getBubbleRadius(1)).toBeLessThan(getBubbleRadius(48));
    expect(getBubbleRadius(1_000_000)).toBe(MAX_BUBBLE_RADIUS_PX);
  });
});

function getEvaluated(
  expression: unknown,
  properties: BubbleProperties,
  seconds: number,
  complete = false,
): number {
  return getEvaluatedNumber(expression, properties, {
    [BUBBLE_SECONDS_STATE]: getBubbleSeconds(seconds, complete),
  });
}

describe('bubble paint expressions', () => {
  const bubble = { reports: 48, mmiReports: 48 * 6, arrival: 10 };

  it('hide a bubble until the S wave reaches its earliest cell', () => {
    expect(getEvaluated(getBubbleOpacityExpression(), bubble, 9.9)).toBe(0);
    expect(getEvaluated(getBubbleOpacityExpression(), bubble, 11)).toBeGreaterThan(
      SETTLED_BUBBLE_OPACITY,
    );
  });

  it('settle to the resting opacity and size once the pulse is over or the run completes', () => {
    const settledAt = bubble.arrival + getPulseLengthSeconds(6) + 1;
    expect(getEvaluated(getBubbleOpacityExpression(), bubble, settledAt)).toBe(
      SETTLED_BUBBLE_OPACITY,
    );
    expect(getEvaluated(getBubbleOpacityExpression(), bubble, 0, true)).toBe(
      SETTLED_BUBBLE_OPACITY,
    );
    expect(getEvaluated(getBubbleRadiusExpression(), bubble, 0, true)).toBeCloseTo(
      getBubbleRadius(48),
    );
  });

  it('swell with the same pulse as the ShakeMap surface', () => {
    const pulse = getPulse(2, 6);
    expect(getEvaluated(getBubbleRadiusExpression(), bubble, 12)).toBeCloseTo(
      getBubbleRadius(48) * (1 + 0.35 * pulse),
    );
  });

  it('write light text on the darkest reds only, by the weighted mean', () => {
    const textColor = getBubbleTextColorExpression();
    const dark = getEvaluatedValue(textColor, { ...bubble, mmiReports: 48 * 6 });
    const light = getEvaluatedValue(textColor, { ...bubble, mmiReports: 48 * 9 });
    expect(dark).not.toBe(light);
    expect(light).toBe('rgb(255, 255, 255)');
  });
});

describe('getStrongestCell', () => {
  it('picks the highest Intensity cell, keeping its report count', () => {
    const strongest = getCell(-81, 8, 9.5, 1);
    expect(getStrongestCell([getCell(-82, 8, 4, 20), strongest, getCell(-82, 9, 6, 2)])).toBe(
      strongest,
    );
    expect(getStrongestCell([])).toBeNull();
  });
});

describe('getFramedRunEndSeconds', () => {
  it('ends when the farthest framed cell has settled, ignoring far-flung outliers', () => {
    const near = Array.from({ length: 9 }, (_, index) => getCell(-82 + index * 0.1, 8, 4));
    const outlier = getCell(-100, 20, 3);
    const farthestNear = near.at(-1) as FeltReportCell;
    const expected =
      getArrivalSeconds(getDistanceKm(EPICENTER, farthestNear), DEPTH_KM, S_WAVE_KM_S) +
      getPulseLengthSeconds(4);
    expect(getFramedRunEndSeconds([...near, outlier], EPICENTER, DEPTH_KM)).toBeCloseTo(expected);
  });

  it('is 0 without cells', () => {
    expect(getFramedRunEndSeconds([], EPICENTER, DEPTH_KM)).toBe(0);
  });
});
